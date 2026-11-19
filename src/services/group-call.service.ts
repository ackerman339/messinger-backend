import { randomUUID } from 'node:crypto';
import { EntityManager, IsNull, LessThanOrEqual } from 'typeorm';
import { z } from 'zod';
import { AppDataSource } from '@config/database';
import { CallMedia, ConversationEventType, ConversationRole, ConversationType } from '@appTypes';
import { CALL_RING_TIMEOUT_MS, WS_SERVER_EVENTS } from '@constants';
import { Conversation, ConversationMember, GroupCall, User } from '@entities';
import { ForbiddenException, NotFoundException } from '@exceptions';
import { ConversationEventRepository, ConversationMemberRepository } from '@repositories';
import { connectionManager } from '@websocket/managers/connection-manager';
import { sendMessage } from '@websocket/send-message';
import { livekitService } from './livekit.service';
import { pushNotificationService } from './push-notification.service';

const ROOM_PREFIX = 'group-call-';
const uuid = z.uuid();

function roomName(callId: string) {
  return ROOM_PREFIX + callId;
}

function callView(call: GroupCall) {
  return {
    id: call.id,
    conversationId: call.conversationId,
    startedBy: call.startedBy,
    media: call.media,
    createdAt: call.createdAt,
    endedAt: call.endedAt,
    ringingUntil: call.ringingUntil,
  };
}

type Notice = {
  call: GroupCall;
  event?: Awaited<ReturnType<typeof ConversationEventRepository.createEvent>>;
  ringingUsers?: string[];
  groupName?: string;
};

class GroupCallService {
  private async lockGroup(manager: EntityManager, conversationId: string) {
    const group = await manager.findOne(Conversation, {
      where: { id: conversationId, type: ConversationType.GROUP },
      lock: { mode: 'pessimistic_write' },
    });
    if (!group) throw new NotFoundException('GROUP_CALL:GROUP_NOT_FOUND');
    return group;
  }

  private async requireMember(manager: EntityManager, conversationId: string, userId: string) {
    const member = await manager.findOne(ConversationMember, {
      where: { conversationId, userId, softDeletedAt: IsNull() },
      lock: { mode: 'pessimistic_read' },
    });
    if (!member) throw new ForbiddenException('GROUP_CALL:NOT_A_MEMBER');
    return member;
  }

  private findActive(manager: EntityManager, conversationId: string) {
    return manager.findOneBy(GroupCall, { conversationId, endedAt: IsNull() });
  }

  private async finish(manager: EntityManager, call: GroupCall, actorId: string): Promise<Notice> {
    const ringingUsers = call.ringingUserIds;
    call.ringingUserIds = [];
    call.ringingUntil = null;
    call.endedAt = new Date();
    await manager.save(GroupCall, call);
    const event = await ConversationEventRepository.createEvent(
      {
        conversationId: call.conversationId,
        actorId,
        type: ConversationEventType.GROUP_CALL_ENDED,
        metadata: { groupCallId: call.id, media: call.media },
      },
      manager
    );
    return { call, event, ringingUsers };
  }

  private async checkRoom(manager: EntityManager, call: GroupCall | null) {
    if (!call) return {};
    const room = await livekitService.findRoom(roomName(call.id));
    if (room?.sid === call.roomSid) return { call };
    return { ended: await this.finish(manager, call, call.startedBy) };
  }

  private async finishIfEmpty(manager: EntityManager, call: GroupCall, actorId: string) {
    const name = roomName(call.id);
    if (await livekitService.hasParticipants(name)) return;
    await livekitService.deleteRoom(name);
    return this.finish(manager, call, actorId);
  }

  private async notify({ call, event, ringingUsers, groupName }: Notice) {
    const type = call.endedAt
      ? WS_SERVER_EVENTS.GROUP_CALL_ENDED
      : WS_SERVER_EVENTS.GROUP_CALL_STARTED;
    const members = await ConversationMemberRepository.getMembers(call.conversationId);
    for (const { userId } of members) {
      for (const connection of connectionManager.getUserConnections(userId)) {
        sendMessage(connection, {
          type,
          data: {
            call: {
              ...callView(call),
              ringingUntil: ringingUsers?.includes(userId) ? call.ringingUntil : null,
            },
            conversationEvent: event,
            groupName,
          },
        });
      }
    }
    if (call.endedAt) {
      for (const userId of ringingUsers ?? []) this.notifyRingClosed(call, userId, groupName);
    } else if (groupName) {
      for (const userId of ringingUsers ?? [])
        this.pushRing('group-call-incoming', call, userId, groupName);
    }
  }

  private pushRing(
    type: 'group-call-incoming' | 'group-call-missed' | 'group-call-closed',
    call: GroupCall,
    userId: string,
    groupName = 'Grupo'
  ) {
    const kind = call.media === CallMedia.VIDEO ? 'videollamada' : 'llamada';
    const ttl =
      type === 'group-call-incoming'
        ? Math.max(0, Math.ceil(((call.ringingUntil?.getTime() ?? 0) - Date.now()) / 1000))
        : type === 'group-call-closed'
          ? 60
          : 86_400;
    if (ttl <= 0) return;
    void pushNotificationService.sendToUser(
      userId,
      {
        title: type === 'group-call-missed' ? `Llamada perdida en ${groupName}` : groupName,
        body:
          type === 'group-call-missed'
            ? `No contestaste una ${kind} grupal.`
            : `Tienes una ${kind} grupal.`,
        icon: '/pwa-192x192.png',
        data: {
          type,
          callId: call.id,
          conversationId: call.conversationId,
          callerId: call.startedBy,
          groupName,
          media: call.media,
          expiresAt: call.ringingUntil?.toISOString() ?? null,
        },
      },
      { TTL: ttl, urgency: 'high', topic: call.id.replaceAll('-', '') }
    );
  }

  private notifyRingClosed(call: GroupCall, userId: string, groupName?: string, missed = false) {
    for (const connection of connectionManager.getUserConnections(userId)) {
      sendMessage(connection, {
        type: WS_SERVER_EVENTS.GROUP_CALL_RING_CLOSED,
        data: { callId: call.id, conversationId: call.conversationId },
      });
    }
    this.pushRing(missed ? 'group-call-missed' : 'group-call-closed', call, userId, groupName);
  }

  private stopRingback(call: GroupCall) {
    for (const connection of connectionManager.getUserConnections(call.startedBy)) {
      sendMessage(connection, {
        type: WS_SERVER_EVENTS.GROUP_CALL_RING_CLOSED,
        data: { callId: call.id, conversationId: call.conversationId },
      });
    }
  }

  closeRingingNotifications(call: GroupCall, userIds = call.ringingUserIds) {
    for (const userId of userIds) this.notifyRingClosed(call, userId);
    if (!call.ringingUserIds.length) this.stopRingback(call);
  }

  private async consumeRing(manager: EntityManager, call: GroupCall, userId: string) {
    if (!call.ringingUserIds.includes(userId)) return false;
    call.ringingUserIds = call.ringingUserIds.filter((id) => id !== userId);
    if (!call.ringingUserIds.length) call.ringingUntil = null;
    await manager.save(GroupCall, call);
    return true;
  }

  private async credentials(manager: EntityManager, call: GroupCall, userId: string) {
    const user = await manager.findOneBy(User, { id: userId });
    if (!user) throw new ForbiddenException('GROUP_CALL:NOT_A_MEMBER');
    return {
      call: callView(call),
      ...livekitService.issueAccess(roomName(call.id), userId, user.username, call.media),
    };
  }

  async getActive(conversationId: string, userId: string) {
    livekitService.assertConfigured();
    const { call, ended } = await AppDataSource.transaction(async (manager) => {
      await this.lockGroup(manager, conversationId);
      await this.requireMember(manager, conversationId, userId);
      return this.checkRoom(manager, await this.findActive(manager, conversationId));
    });
    if (ended) await this.notify(ended);
    return call ? callView(call) : null;
  }

  async start(conversationId: string, userId: string, media: CallMedia) {
    livekitService.assertConfigured();
    const { ended, started, access, accepted } = await AppDataSource.transaction(
      async (manager) => {
        const group = await this.lockGroup(manager, conversationId);
        await this.requireMember(manager, conversationId, userId);
        const { call, ended } = await this.checkRoom(
          manager,
          await this.findActive(manager, conversationId)
        );
        if (call) {
          const accepted = (await this.consumeRing(manager, call, userId)) ? call : undefined;
          return { access: await this.credentials(manager, call, userId), accepted };
        }

        const id = randomUUID();
        const room = await livekitService.createRoom(roomName(id));
        const ringingUsers = (
          await ConversationMemberRepository.getMembers(conversationId, manager)
        )
          .map(({ userId }) => userId)
          .filter((id) => id !== userId);
        const newCall = await manager.save(
          GroupCall,
          manager.create(GroupCall, {
            id,
            conversationId,
            startedBy: userId,
            media,
            roomSid: room.sid,
            endedAt: null,
            ringingUserIds: ringingUsers,
            ringingUntil: ringingUsers.length ? new Date(Date.now() + CALL_RING_TIMEOUT_MS) : null,
          })
        );
        const event = await ConversationEventRepository.createEvent(
          {
            conversationId,
            actorId: userId,
            type: ConversationEventType.GROUP_CALL_STARTED,
            metadata: { groupCallId: id, media },
          },
          manager
        );
        return {
          ended,
          started: { call: newCall, event, ringingUsers, groupName: group.name || 'Grupo' },
          access: await this.credentials(manager, newCall, userId),
        };
      }
    );
    if (ended) await this.notify(ended);
    if (started) await this.notify(started);
    if (accepted) {
      this.notifyRingClosed(accepted, userId);
      this.stopRingback(accepted);
    }
    return { ...access, created: !!started };
  }

  async join(conversationId: string, callId: string, userId: string, fromNotification = false) {
    livekitService.assertConfigured();
    const { access, ended, accepted } = await AppDataSource.transaction(async (manager) => {
      await this.lockGroup(manager, conversationId);
      await this.requireMember(manager, conversationId, userId);
      const active = await this.findActive(manager, conversationId);
      if (active?.id !== callId) return {};
      if (
        fromNotification &&
        (!active.ringingUserIds.includes(userId) ||
          !active.ringingUntil ||
          active.ringingUntil.getTime() <= Date.now())
      )
        return {};
      const { call, ended } = await this.checkRoom(manager, active);
      if (!call) return { ended };
      const accepted = (await this.consumeRing(manager, call, userId)) ? call : undefined;
      return { access: await this.credentials(manager, call, userId), accepted };
    });
    if (ended) await this.notify(ended);
    if (!access) throw new NotFoundException('GROUP_CALL:NOT_ACTIVE');
    if (accepted) {
      this.notifyRingClosed(accepted, userId);
      this.stopRingback(accepted);
    }
    return access;
  }

  async decline(conversationId: string, callId: string, userId: string) {
    const declined = await AppDataSource.transaction(async (manager) => {
      const group = await this.lockGroup(manager, conversationId);
      await this.requireMember(manager, conversationId, userId);
      const call = await this.findActive(manager, conversationId);
      if (call?.id !== callId || !(await this.consumeRing(manager, call, userId))) return;
      return { call, groupName: group.name || 'Grupo' };
    });
    if (declined) {
      this.notifyRingClosed(declined.call, userId, declined.groupName);
      if (!declined.call.ringingUserIds.length) this.stopRingback(declined.call);
    }
  }

  async expireRinging() {
    const now = new Date();
    const due = await AppDataSource.manager.findBy(GroupCall, {
      ringingUntil: LessThanOrEqual(now),
    });
    for (const { id, conversationId } of due) {
      const expired = await AppDataSource.transaction(async (manager) => {
        const group = await manager.findOne(Conversation, {
          where: { id: conversationId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!group) return;
        const call = await manager.findOneBy(GroupCall, { id });
        if (!call?.ringingUntil || call.ringingUntil > now || call.endedAt) return;
        const members = await ConversationMemberRepository.getMembers(conversationId, manager);
        const pending = new Set(call.ringingUserIds);
        call.ringingUserIds = [];
        call.ringingUntil = null;
        await manager.save(GroupCall, call);
        return {
          call,
          groupName: group.name || 'Grupo',
          members: members.filter(({ userId }) => pending.has(userId)),
        };
      });
      if (expired) {
        for (const { userId } of expired.members)
          this.notifyRingClosed(expired.call, userId, expired.groupName, true);
      }
    }
  }

  async leave(conversationId: string, callId: string, userId: string) {
    livekitService.assertConfigured();
    const ended = await AppDataSource.transaction(async (manager) => {
      await this.lockGroup(manager, conversationId);
      await this.requireMember(manager, conversationId, userId);
      const active = await this.findActive(manager, conversationId);
      if (active?.id !== callId) return;
      await livekitService.removeParticipant(roomName(callId), userId);
      return this.finishIfEmpty(manager, active, userId);
    });
    if (ended) await this.notify(ended);
  }

  async end(conversationId: string, callId: string, userId: string) {
    livekitService.assertConfigured();
    const ended = await AppDataSource.transaction(async (manager) => {
      await this.lockGroup(manager, conversationId);
      const member = await this.requireMember(manager, conversationId, userId);
      const call = await manager.findOneBy(GroupCall, { id: callId, conversationId });
      if (!call) throw new NotFoundException('GROUP_CALL:NOT_FOUND');
      if (member.role !== ConversationRole.OWNER && call.startedBy !== userId) {
        throw new ForbiddenException('GROUP_CALL:CANNOT_END');
      }
      if (call.endedAt) return;
      await livekitService.deleteRoom(roomName(callId));
      return this.finish(manager, call, userId);
    });
    if (ended) await this.notify(ended);
  }

  async removeGroupMember(manager: EntityManager, conversationId: string, userId: string) {
    const call = await this.findActive(manager, conversationId);
    if (!call) return;
    await livekitService.removeParticipant(roomName(call.id), userId);
    return (await this.consumeRing(manager, call, userId)) ? call : undefined;
  }

  async deleteGroupRoom(manager: EntityManager, conversationId: string) {
    const call = await this.findActive(manager, conversationId);
    if (!call) return;
    await livekitService.deleteRoom(roomName(call.id));
    return call;
  }

  async receiveWebhook(body: unknown, authorization: string | undefined) {
    const { event, room, participant } = livekitService.readWebhook(body, authorization);
    if (!room?.name.startsWith(ROOM_PREFIX)) return;
    const id = room.name.slice(ROOM_PREFIX.length);
    if (!uuid.safeParse(id).success) return;
    // A failed initial ICE attempt can be followed by another join with TURN.
    // Only a participant that was connected can trigger early room finalization.
    if (
      event !== 'room_finished' &&
      event !== 'participant_joined' &&
      event !== 'participant_left'
    ) {
      return;
    }

    const groupCall = await AppDataSource.manager.findOneBy(GroupCall, { id, roomSid: room.sid });
    if (!groupCall) return;
    const ended = await AppDataSource.transaction(async (manager) => {
      const group = await manager.findOne(Conversation, {
        where: { id: groupCall.conversationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!group) return null;
      const call = await manager.findOneBy(GroupCall, { id, roomSid: room.sid });
      if (!call || call.endedAt) return null;
      if (event === 'room_finished') return this.finish(manager, call, call.startedBy);
      if (event === 'participant_left') {
        const actorId =
          participant && uuid.safeParse(participant.identity).success
            ? participant.identity
            : call.startedBy;
        return this.finishIfEmpty(manager, call, actorId);
      }

      // Self-hosted LiveKit can accept a recently issued token after removal.
      if (participant) {
        const member =
          uuid.safeParse(participant.identity).success &&
          (await manager.existsBy(ConversationMember, {
            conversationId: call.conversationId,
            userId: participant.identity,
            softDeletedAt: IsNull(),
          }));
        if (!member) await livekitService.removeParticipant(room.name, participant.identity);
      }
      return null;
    });
    if (ended) await this.notify(ended);
  }
}

export const groupCallService = new GroupCallService();
