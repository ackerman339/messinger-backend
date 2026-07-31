import { EventEmitter } from 'node:events';
import { ConversationEventType } from '@appTypes';
import { ConversationMember } from '@entities';

type MemberLeftPayload = {
  conversationId: string;
  userId: string;
  members: ConversationMember[];
};

type MemberRemovedPayload = {
  conversationId: string;
  actorId: string;
  removedUserId: string;
  members: ConversationMember[];
};

type OwnerChangedPayload = {
  conversationId: string;
  previousOwnerId: string;
  newOwnerId: string;
  members: ConversationMember[];
};

type GroupDeletedPayload = {
  conversationId: string;
  members: ConversationMember[];
};

class GroupEvents extends EventEmitter {
  emitMemberLeft(payload: MemberLeftPayload) {
    this.emit(ConversationEventType.MEMBER_LEFT, payload);
  }

  emitMemberRemoved(payload: MemberRemovedPayload) {
    this.emit(ConversationEventType.MEMBER_REMOVED, payload);
  }

  emitOwnerChanged(payload: OwnerChangedPayload) {
    this.emit(ConversationEventType.OWNERSHIP_TRANSFERRED, payload);
  }

  emitGroupDeleted(payload: GroupDeletedPayload) {
    this.emit(ConversationEventType.GROUP_DELETED, payload);
  }
}

export const groupEvents = new GroupEvents();
