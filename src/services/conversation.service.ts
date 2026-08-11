import { addHours, isAfter } from 'date-fns';
import { AppDataSource } from '@config/database';
import { createHash } from 'node:crypto';
import { ConversationType, ConversationRole, ConversationEventType } from '@appTypes';
import { ForbiddenException, NotFoundException } from '@exceptions';
import { groupEvents } from '@events';
import { Conversation } from '@entities';
import { messageService } from '@services';

import {
  CreateGroupDto,
  InviteGroupMemberDto,
  TransferOwnershipDto,
  RemoveMemberDto,
  DeleteConversationDto,
  ListConversationsDto,
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
    return AppDataSource.transaction(async (manager) => {
      await ConversationMemberRepository.markConversationAsDeleted(
        conversationId,
        targetUserId,
        manager
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
    });
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

  async getOrCreatePrivateConversation({ type, creatorId, members }: CreateConversationParams) {
    let privateKey: string | null = null;
    const uniqueMembers = this.normalizeMembers(creatorId, members);

    // Prevent duplicate private conversations.
    if (type === ConversationType.PRIVATE) {
      if (uniqueMembers.length > 2) {
        throw new ForbiddenException('CREATE_CONVERSATION:PRIVATE_CONVERSATION_REQUIRES_TWO_USERS');
      }

      privateKey = this.generatePrivateKey(uniqueMembers);
      const existing = await ConversationRepository.findByPrivateKey(privateKey);

      if (existing) {
        return existing;
      }
    }

    return AppDataSource.transaction(async (manager) => {
      const newConversation = ConversationRepository.create({
        type,
        privateKey,
      });

      const savedConversation = await ConversationRepository.saveConversation(
        newConversation,
        manager
      );

      const conversationMembers = uniqueMembers.map((userId) => ({
        userId,
        conversationId: savedConversation.id,
        role: this.getMemberRole({ type, userId, creatorId }),
      }));

      await ConversationMemberRepository.bulkCreate(conversationMembers, manager);

      return manager.getRepository(Conversation).findOne({
        where: { id: savedConversation.id },
        relations: {
          members: {
            user: true,
          },
        },
      });
    });
  }

  async createGroup(ownerId: string, { name }: CreateGroupDto) {
    return AppDataSource.transaction(async (manager) => {
      const conversation = ConversationRepository.create({
        type: ConversationType.GROUP,
        name,
      });

      const savedConversation = await ConversationRepository.saveConversation(
        conversation,
        manager
      );

      await ConversationMemberRepository.bulkCreate(
        [
          {
            userId: ownerId,
            conversationId: savedConversation.id,
            role: ConversationRole.OWNER,
          },
        ],
        manager
      );
      await ConversationEventRepository.createEvent(
        {
          conversationId: savedConversation.id,
          actorId: ownerId,
        },
        manager
      );

      return savedConversation;
    });
  }

  async validateGroupInvitation(
    actorId: string,
    { conversationId, targetUserId }: InviteGroupMemberDto
  ) {
    const [conversation, actor, alreadyMember] = await Promise.all([
      ConversationRepository.findById(conversationId),
      ConversationMemberRepository.findMember(conversationId, actorId),
      ConversationMemberRepository.exists(conversationId, targetUserId),
    ]);

    if (!conversation) {
      throw new NotFoundException('GROUP_INVITATION:CONVERSATION_NOT_FOUND');
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ForbiddenException('GROUP_INVITATION:INVALID_CONVERSATION_TYPE');
    }

    if (!actor) {
      throw new ForbiddenException('GROUP_INVITATION:USER_IS_NOT_MEMBER');
    }

    if (actor.role !== ConversationRole.OWNER) {
      throw new ForbiddenException('GROUP_INVITATION:ONLY_OWNER_CAN_INVITE');
    }

    if (actorId === targetUserId) {
      throw new ForbiddenException('GROUP_INVITATION:CANNOT_INVITE_YOURSELF');
    }

    if (alreadyMember) {
      throw new ForbiddenException('GROUP_INVITATION:USER_ALREADY_MEMBER');
    }

    await GroupInvitationRepository.createInvitation({
      conversationId,
      actorId,
      targetId: targetUserId,
      expiresAt: addHours(new Date(), 24),
    });

    return conversation;
  }

  async acceptGroupInvitation(conversationId: string, userId: string) {
    const [conversation, member, members, invitation] = await Promise.all([
      ConversationRepository.findById(conversationId),
      ConversationMemberRepository.findMember(conversationId, userId),
      ConversationRepository.getConversationMembers(conversationId),
      GroupInvitationRepository.findOne({ where: { conversationId, targetId: userId } }),
    ]);

    if (!conversation) {
      throw new NotFoundException('GROUP:NOT_FOUND');
    }

    if (!invitation) {
      throw new NotFoundException('GROUP_INVITATION:NOT_FOUND');
    }

    if (isAfter(new Date(), invitation.expiresAt)) {
      await GroupInvitationRepository.markInvitationAsExpired(conversationId, userId);
      throw new ForbiddenException('GROUP_INVITATION:EXPIRED');
    }

    await AppDataSource.transaction(async (manager) => {
      if (member?.softDeletedAt) {
        await ConversationMemberRepository.restoreConversation(conversationId, userId, manager);
      } else {
        await GroupInvitationRepository.acceptInvitation(conversationId, userId, manager);

        await ConversationEventRepository.createEvent(
          {
            conversationId,
            actorId: userId,
            type: ConversationEventType.MEMBER_JOINED,
          },
          manager
        );

        await ConversationMemberRepository.bulkCreate(
          [
            {
              conversationId,
              userId,
              role: ConversationRole.MEMBER,
            },
          ],
          manager
        );
      }
    });

    return { members };
  }

  async rejectGroupInvitation(conversationId: string, userId: string) {
    const invitation = await GroupInvitationRepository.findOne({
      where: { conversationId, targetId: userId },
    });

    if (!invitation) {
      throw new NotFoundException('GROUP_INVITATION:NOT_FOUND');
    }

    if (isAfter(new Date(), invitation.expiresAt)) {
      await GroupInvitationRepository.markInvitationAsExpired(conversationId, userId);
      throw new ForbiddenException('GROUP_INVITATION:EXPIRED');
    }

    await GroupInvitationRepository.rejectInvitation(conversationId, userId);
  }

  async leaveGroup(userId: string, conversationId: string) {
    const [members, member] = await Promise.all([
      ConversationRepository.getConversationMembers(conversationId),
      ConversationMemberRepository.findMember(conversationId, userId),
    ]);

    if (!member) {
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
    if (prevOwner === newOwnerId) {
      throw new ForbiddenException('GROUP:INVALID_OWNER');
    }

    const [owner, newOwner, members] = await Promise.all([
      ConversationMemberRepository.findMember(conversationId, prevOwner),
      ConversationMemberRepository.findMember(conversationId, newOwnerId),
      ConversationRepository.getConversationMembers(conversationId),
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
      ConversationRepository.getConversationMembers(conversationId),
      ConversationMemberRepository.findMember(conversationId, userId),
      ConversationMemberRepository.findMember(conversationId, targetUserId),
    ]);

    if (!conversation) {
      throw new NotFoundException('CONVERSATION_NOT_FOUND');
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ForbiddenException('REMOVE_MEMBER:NOT_A_GROUP');
    }

    if (!actor) {
      throw new ForbiddenException('REMOVE_MEMBER:NOT_GROUP_MEMBER');
    }

    if (actor.role !== ConversationRole.OWNER) {
      throw new ForbiddenException('REMOVE_MEMBER:ONLY_OWNER');
    }

    if (!targetUser) {
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
      ConversationRepository.getConversationMembers(conversationId),
    ]);

    if (!conversation) {
      throw new NotFoundException('GROUP:NOT_FOUND');
    }

    if (conversation.type !== ConversationType.GROUP) {
      throw new ForbiddenException('GROUP:INVALID_TYPE');
    }

    if (!owner) {
      throw new ForbiddenException('GROUP:USER_NOT_MEMBER');
    }

    if (owner.role !== ConversationRole.OWNER) {
      throw new ForbiddenException('GROUP:ONLY_OWNER');
    }

    await AppDataSource.transaction(async (manager) => {
      await ConversationRepository.deleteConversation(conversationId, manager);
    });

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

    const conversationsWithMessages = await Promise.all(
      conversations.map(async (conversation) => {
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
          members: conversation.members
            .filter((member) => member.user.id !== userId)
            .map((member) => ({
              ...member.user,
            })),
        };
      })
    );

    return conversationsWithMessages;
  }
}

export const conversationService = new ConversationService();
