export enum MessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
}

export enum ConversationRole {
  OWNER = 'OWNER',
  MEMBER = 'MEMBER',
}

export enum ConversationType {
  PRIVATE = 'PRIVATE',
  GROUP = 'GROUP',
}

export enum ConversationEventType {
  GROUP_CREATED = 'GROUP_CREATED',
  GROUP_DELETED = 'GROUP_DELETED',
  MEMBER_INVITED = 'MEMBER_INVITED',
  MEMBER_JOINED = 'MEMBER_JOINED',
  MEMBER_LEFT = 'MEMBER_LEFT',
  MEMBER_REMOVED = 'MEMBER_REMOVED',
  OWNERSHIP_TRANSFERRED = 'OWNERSHIP_TRANSFERRED',
}

export enum GroupInvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}
