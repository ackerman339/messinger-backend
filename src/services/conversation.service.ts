import type { EntityManager } from 'typeorm';
import { addHours, isAfter } from 'date-fns';
import { AppDataSource } from '@config/database';
import { createHash } from 'node:crypto';
import {
  ConversationType,
  ConversationRole,
  ConversationEventType,
  GroupInvitationStatus,
} from '@appTypes';
import { ForbiddenException, NotFoundException } from '@exceptions';
import { groupEvents } from '@events';
import { Conversation, ConversationMember, GroupInvitation, User } from '@entities';
import { messageService } from '@services';
import { groupCallService } from './group-call.service';
import { paginate } from '@utils';

import {
  CreateGroupDto,
  InviteGroupMemberDto,
  TransferOwnershipDto,
  RemoveMemberDto,
  DeleteConversationDto,
  ListConversationsDto,
  ResetUnreadMessagesCountDto,
} from '@dtos';

import {
  ConversationRepository,
  ConversationMemberRepository,
  ConversationEventRepository,
  GroupInvitationRepository,
} from '@repositories';

type CreateConversationParams = {
  type: ConversationType;
  creatorId: string;
  members: string[];
};

type GetMemberRolParams = {
  type: ConversationType;
  userId: string;
  creatorId: string;
};

type RemoveMemberParams = {
  conversationId: string;
  actorId: string;
  targetUserId: string;
  eventType: ConversationEventType;
};

class ConversationService {
  private async removeMemberFromGroup({
    conversationId,
    actorId,
    targetUserId,
    eventType,
  }: RemoveMemberParams) {
    const ringingCall = await AppDataSource.transaction(async (manager) => {
      const conversation = await manager.findOne(Conversation, {
        where: { id: conversationId, type: ConversationType.GROUP },
        lock: { mode: 'pessimistic_write' },
      });
      if (!conversation) throw new NotFoundException('GROUP:NOT_FOUND');
      await ConversationMemberRepository.markConversationAsDeleted(
        conversationId,
        targetUserId,
        manager
      );
      const ringingCall = await groupCallService.removeGroupMember(
        manager,
        conversationId,
        targetUserId
      );

      await ConversationEventRepository.createEvent(
        {
          conversationId,
          actorId,
          targetUserId,
          type: eventType,
        },
        manager
      );
      return ringingCall;
    });
    if (ringingCall) groupCallService.closeRingingNotifications(ringingCall, [targetUserId]);
  }

  private normalizeMembers(creatorId: string, members: string[]) {
    return [creatorId, ...members].filter((id, index, array) => array.indexOf(id) === index);
  }

  private generatePrivateKey(userIds: string[]) {
    const value = userIds.sort().join(':');

    return createHash('sha256').update(value).digest('hex');
  }

  private getMemberRole({ type, userId, creatorId }: GetMemberRolParams) {
    if (type === ConversationType.GROUP && userId === creatorId) {
      return ConversationRole.OWNER;
    }

    return ConversationRole.MEMBER;
  }

  async getOrCreatePrivateConversation(
    params: CreateConversationParams,
    manager: EntityManager
  ): Promise<Conversation | null> {
    const { type, creatorId, members } = params;
    let privateKey: string | null = null;
    const uniqueMembers = this.normalizeMembers(creatorId, members);
    const repository = manager.getRepository(Conversation);

    if (type === ConversationType.PRIVATE) {
      if (uniqueMembers.length > 2) {
        throw new ForbiddenException('CREATE_CONVERSATION:PRIVATE_CONVERSATION_REQUIRES_TWO_USERS');
      }
      privateKey = this.generatePrivateKey(uniqueMembers);
      await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `private:${privateKey}`,
      ]);
      const existing = await repository.findOne({
        where: { privateKey },
        relations: { members: { user: true } },
      });
      if (existing) return existing;
      for (const id of uniqueMembers) {
        if (!(await manager.getRepository(User).existsBy({ id }))) {
          throw new NotFoundException('CONVERSATION:USER_NOT_FOUND');
        }
      }
    }

    const savedConversation = await ConversationRepository.saveConversation(
      ConversationRepository.create({ type, privateKey }),
      manager
    );
    await ConversationMemberRepository.bulkCreate(
      uniqueMembers.map((userId) => ({
        userId,
        conversationId: savedConversation.id,
        role: this.getMemberRole({ type, userId, creatorId }),
      })),
      manager
    );
    return repository.findOne({
      where: { id: savedConversation.id },
      relations: { members: { user: true } },
    });
  }

  async createGroup(ownerId: string, { name, members }: CreateGroupDto) {
    const result = await AppDataSource.transaction(async (manager) => {
      const conversation = await ConversationRepository.saveConversation(
        ConversationRepository.create({ type: ConversationType.GROUP, name }),
        manager
      );
      await ConversationMemberRepository.bulkCreate(
        [{ userId: ownerId, conversationId: conversation.id, role: ConversationRole.OWNER }],
        manager
      );
      await ConversationEventRepository.createEvent(
        { conversationId: conversation.id, actorId: ownerId },
        manager
      );
      const invitations = [];
      for (const targetId of new Set(members ?? [])) {
        if (targetId === ownerId) continue;
        invitations.push(
          await GroupInvitationRepository.createInvitation(
            {
              conversationId: conversation.id,
              actorId: ownerId,
              targetId,
              expiresAt: addHours(new Date(), 24),
            },
            manager
          )
        );
      }
      return { conversation, invitations };
    });
    for (const invitation of result.invitations) {
      groupEvents.emit(ConversationEventType.MEMBER_INVITED, {
        targetUserId: invitation.targetId,
        invitationId: invitation.id,
        conversationId: result.conversation.id,
        groupName: result.conversation.name,
        invitedBy: ownerId,
      });
    }
    return result.conversation;
  }

  async validateGroupInvitation(
    actorId: string,
    { conversationId, targetUserId }: InviteGroupMemberDto
  ) {
    return AppDataSource.transaction(async (manager) => {
      const conversation = await manager.getRepository(Conversation).findOne({
        where: { id: conversationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!conversation) throw new NotFoundException('GROUP_INVITATION:CONVERSATION_NOT_FOUND');
      if (conversation.type !== ConversationType.GROUP) {
        throw new ForbiddenException('GROUP_INVITATION:INVALID_CONVERSATION_TYPE');
      }
      const repository = manager.getRepository(ConversationMember);
      const actor = await repository.findOne({ where: { conversationId, userId: actorId } });
      if (!actor || actor.softDeletedAt) {
        throw new ForbiddenException('GROUP_INVITATION:USER_IS_NOT_MEMBER');
      }
      if (actor.role !== ConversationRole.OWNER) {
        throw new ForbiddenException('GROUP_INVITATION:ONLY_OWNER_CAN_INVITE');
      }
      if (actorId === targetUserId)
        throw new ForbiddenException('GROUP_INVITATION:CANNOT_INVITE_YOURSELF');
      const target = await repository.findOne({ where: { conversationId, userId: targetUserId } });
      if (target && !target.softDeletedAt) {
        throw new ForbiddenException('GROUP_INVITATION:USER_ALREADY_MEMBER');
      }
      const invitations = manager.getRepository(GroupInvitation);
      const pending = await invitations.findOne({
        where: { conversationId, targetId: targetUserId, status: GroupInvitationStatus.PENDING },
        order: { createdAt: 'DESC', id: 'DESC' },
      });
      if (pending && !isAfter(new Date(), pending.expiresAt)) {
        return { ...conversation, invitationId: pending.id };
      }
      await invitations.update(
        { conversationId, targetId: targetUserId, status: GroupInvitationStatus.PENDING },
        { status: GroupInvitationStatus.EXPIRED }
      );
      const invitation = await GroupInvitationRepository.createInvitation(
        {
          conversationId,
          actorId,
          targetId: targetUserId,
          expiresAt: addHours(new Date(), 24),
        },
        manager
      );
      return { ...conversation, invitationId: invitation.id };
    });
  }

  private async respondToGroupInvitation(conversationId: string, userId: string, accept: boolean) {
    const result = await AppDataSource.transaction(async (manager) => {
      const conversation = await manager.getRepository(Conversation).findOne({
        where: { id: conversationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!conversation || conversation.type !== ConversationType.GROUP) {
        throw new NotFoundException('GROUP:NOT_FOUND');
      }
      const invitations = manager.getRepository(GroupInvitation);
      const invitation = await invitations.findOne({
        where: { conversationId, targetId: userId, status: GroupInvitationStatus.PENDING },
        order: { createdAt: 'DESC', id: 'DESC' },
      });
      if (!invitation) throw new NotFoundException('GROUP_INVITATION:NOT_FOUND');
      if (isAfter(new Date(), invitation.expiresAt)) {
        await invitations.update(
          { conversationId, targetId: userId, status: GroupInvitationStatus.PENDING },
          { status: GroupInvitationStatus.EXPIRED }
        );
        return { expired: true, members: [] };
      }
      await invitations.update(
        { conversationId, targetId: userId, status: GroupInvitationStatus.PENDING },
        { status: accept ? GroupInvitationStatus.ACCEPTED : GroupInvitationStatus.REJECTED }
      );
      if (!accept) return { expired: false, members: [] };
      const member = await manager.getRepository(ConversationMember).findOne({
        where: { conversationId, userId },
      });
      if (member && !member.softDeletedAt) {
        throw new ForbiddenException('GROUP_INVITATION:USER_ALREADY_MEMBER');
      }
      if (member) {
        await ConversationMemberRepository.restoreConversation(conversationId, userId, manager);
      } else {
        await ConversationMemberRepository.bulkCreate(
          [{ conversationId, userId, role: ConversationRole.MEMBER }],
          manager
        );
      }
      await ConversationEventRepository.createEvent(
        { conversationId, actorId: userId, type: ConversationEventType.MEMBER_JOINED },
        manager
      );
      const members = await ConversationMemberRepository.getMembers(conversationId, manager);
      return { expired: false, members };
    });
    if (result.expired) throw new ForbiddenException('GROUP_INVITATION:EXPIRED');
    return { members: result.members };
  }

  async acceptGroupInvitation(conversationId: string, userId: string) {
    return this.respondToGroupInvitation(conversationId, userId, true);
  }

  async rejectGroupInvitation(conversationId: string, userId: string) {
    await this.respondToGroupInvitation(conversationId, userId, false);
  }

  async leaveGroup(userId: string, conversationId: string) {
    const conversation = await ConversationRepository.findById(conversationId);
    if (!conversation || conversation.type !== ConversationType.GROUP) {
      throw new NotFoundException('GROUP:NOT_FOUND');
    }
    const [members, member] = await Promise.all([
      ConversationMemberRepository.getMembers(conversationId),
      ConversationMemberRepository.findMember(conversationId, userId),
    ]);

    if (!member || member.softDeletedAt) {
      throw new ForbiddenException('GROUP:USER_NOT_MEMBER');
    }

    if (member.role === ConversationRole.OWNER) {
      throw new ForbiddenException('GROUP:TRANSFER_OWNERSHIP_FIRST');
    }

    await this.removeMemberFromGroup({
      conversationId,
      actorId: userId,
      targetUserId: userId,
      eventType: ConversationEventType.MEMBER_LEFT,
    });

    groupEvents.emitMemberLeft({
      conversationId,
      userId,
      members,
    });
  }

  async transferGroupOwnership(
    prevOwner: string,
    { conversationId, newOwnerId }: TransferOwnershipDto
  ) {
    const conversation = await ConversationRepository.findById(conversationId);
    if (!conversation || conversation.type !== ConversationType.GROUP) {
      throw new NotFoundException('GROUP:NOT_FOUND');
    }
    if (prevOwner === newOwnerId) {
      throw new ForbiddenException('GROUP:INVALID_OWNER');
    }

    const [owner, newOwner, members] = await Promise.all([
      ConversationMemberRepository.findMember(conversationId, prevOwner),
      ConversationMemberRepository.findMember(conversationId, newOwnerId),
      ConversationMemberRepository.getMembers(conversationId),
    ]);

    if (!owner) {
      throw new ForbiddenException('GROUP:USER_NOT_MEMBER');
    }

    if (owner.role !== ConversationRole.OWNER) {
      throw new ForbiddenException('GROUP:ONLY_OWNER');
    }

    if (owner.softDeletedAt) {
      throw new ForbiddenException('GROUP:OWNER_REMOVED');
    }

    if (!newOwner) {
      throw new ForbiddenException('GROUP:TARGET_NOT_MEMBER');
    }

    if (newOwner.softDeletedAt) {
      throw new ForbiddenException('GROUP:TARGET_REMOVED');
    }

    await AppDataSource.transaction(async (manager) => {
      const group = await manager.findOne(Conversation, {
        where: { id: conversationId, type: ConversationType.GROUP },
        lock: { mode: 'pessimistic_write' },
      });
      if (!group) throw new NotFoundException('GROUP:NOT_FOUND');
      await ConversationMemberRepository.updateRole(
        conversationId,
        prevOwner,
        ConversationRole.MEMBER,
        manager
      );

      await ConversationMemberRepository.updateRole(
        conversationId,
        newOwnerId,
        ConversationRole.OWNER,
        manager
      );

      await ConversationEventRepository.createEvent(
        {
          conversationId,
          actorId: prevOwner,
          targetUserId: newOwnerId,
          type: ConversationEventType.OWNERSHIP_TRANSFERRED,
        },
        manager
      );
    });

    groupEvents.emitOwnerChanged({
      conversationId,
      previousOwnerId: prevOwner,
      newOwnerId,
      members,
    });
  }

  async removeGroupMember(userId: string, { conversationId, targetUserId }: RemoveMemberDto) {
    const [conversation, members, actor, targetUser] = await Promise.all([
      ConversationRepository.findById(conversationId),
      ConversationMemberRepository.getMembers(conversationId),
      ConversationMemberRepository.findMember(conversationId, userId),
      ConversationMemberRepository.findMember(conversationId, targetUserId),
    ]);

    if (!conversation) {
      throw new NotFoundException('CONVERSATION_NOT_FOUND');
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ForbiddenException('REMOVE_MEMBER:NOT_A_GROUP');
    }

    if (!actor || actor.softDeletedAt) {
      throw new ForbiddenException('REMOVE_MEMBER:NOT_GROUP_MEMBER');
    }

    if (actor.role !== ConversationRole.OWNER) {
      throw new ForbiddenException('REMOVE_MEMBER:ONLY_OWNER');
    }

    if (!targetUser || targetUser.softDeletedAt) {
      throw new NotFoundException('REMOVE_MEMBER:TARGET_NOT_FOUND');
    }

    if (targetUser.role === ConversationRole.OWNER) {
      throw new ForbiddenException('REMOVE_MEMBER:CANNOT_REMOVE_OWNER');
    }

    if (userId === targetUserId) {
      throw new ForbiddenException('REMOVE_MEMBER:USE_LEAVE_GROUP');
    }

    await this.removeMemberFromGroup({
      conversationId,
      actorId: userId,
      targetUserId,
      eventType: ConversationEventType.MEMBER_REMOVED,
    });

    groupEvents.emitMemberRemoved({
      conversationId,
      actorId: userId,
      removedUserId: targetUserId,
      members,
    });
  }

  async deleteGroup(userId: string, { conversationId }: DeleteConversationDto) {
    const [conversation, owner, members] = await Promise.all([
      ConversationRepository.findById(conversationId),
      ConversationMemberRepository.findMember(conversationId, userId),
      ConversationMemberRepository.getMembers(conversationId),
    ]);

    if (!conversation) {
      throw new NotFoundException('GROUP:NOT_FOUND');
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ForbiddenException('GROUP:INVALID_TYPE');
    }

    if (!owner || owner.softDeletedAt) {
      throw new ForbiddenException('GROUP:USER_NOT_MEMBER');
    }

    if (owner.role !== ConversationRole.OWNER) {
      throw new ForbiddenException('GROUP:ONLY_OWNER');
    }

    const call = await AppDataSource.transaction(async (manager) => {
      const current = await manager.findOne(Conversation, {
        where: { id: conversationId, type: ConversationType.GROUP },
        lock: { mode: 'pessimistic_write' },
      });
      if (!current) throw new NotFoundException('GROUP:NOT_FOUND');
      const call = await groupCallService.deleteGroupRoom(manager, conversationId);
      await ConversationRepository.deleteConversation(conversationId, manager);
      return call;
    });
    if (call) groupCallService.closeRingingNotifications(call);

    groupEvents.emitGroupDeleted({
      conversationId,
      members,
    });
  }

  async deletePrivateConversation(userId: string, conversationId: string) {
    const [conversation, member] = await Promise.all([
      ConversationRepository.findById(conversationId),
      ConversationMemberRepository.findMember(conversationId, userId),
    ]);

    if (!conversation) {
      throw new NotFoundException('CONVERSATION:NOT_FOUND');
    }

    if (conversation.type !== ConversationType.PRIVATE) {
      throw new ForbiddenException('CONVERSATION:INVALID_TYPE');
    }

    if (!member) {
      throw new ForbiddenException('CONVERSATION:USER_NOT_MEMBER');
    }

    if (member.softDeletedAt) {
      throw new ForbiddenException('CONVERSATION:ALREADY_DELETED');
    }

    await AppDataSource.transaction(async (manager) => {
      await ConversationMemberRepository.markConversationAsDeleted(conversationId, userId, manager);
      const remaining = await ConversationMemberRepository.getRemainingConversations(
        conversationId,
        manager
      );

      if (remaining === 0) {
        await ConversationRepository.deleteConversation(conversationId, manager);
      }
    });
  }

  async getConversationBootstrap(
    userId: string,
    dto: Pick<ListConversationsDto, 'cursor' | 'limit'>
  ) {
    const conversations = await ConversationRepository.getConversationList(userId, dto);
    const { page, nextCursor } = paginate<Conversation>({ items: conversations, limit: dto.limit });

    const conversationsWithMessages = await Promise.all(
      page.map(async (conversation) => {
        const { page, nextCursor } = await messageService.getConversationMessages(userId, {
          conversationId: conversation.id,
          limit: 20,
        });

        return {
          id: conversation.id,
          type: conversation.type,
          name: conversation.name,
          messages: page,
          messagesCursor: nextCursor,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          lastMessage: page.at(0),
          members: conversation.members.map((member) => ({
            userId: member.user.id,
            username: member.user.username,
            lastSeenAt: member.user.lastSeenAt,
            unreadCount: member.unreadCount,
            role: member.role,
            softDeletedAt: member.softDeletedAt,
          })),
        };
      })
    );

    return { page: conversationsWithMessages, nextCursor };
  }

  async resetUnreadMessagesCount(userId: string, dto: ResetUnreadMessagesCountDto) {
    return AppDataSource.transaction(async (manager) => {
      await ConversationMemberRepository.resetUnreadCount(dto.conversationId, userId, manager);
    });
  }

  async emptyMessages(userId: string, conversationId: string) {
    await ConversationMemberRepository.emptyMessages(conversationId, userId);
  }
}

export const conversationService = new ConversationService();
