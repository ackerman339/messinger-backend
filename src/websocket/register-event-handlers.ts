import { createEventDispatcher } from './dispatcher';
import { WS_CLIENT_EVENTS } from '@constants';

import {
  PrivateMessageDto,
  MessageDeliveryDto,
  InviteGroupMemberDto,
  GroupInvitationDto,
  GroupMessageDto,
} from '@dtos';

import {
  privateMessageHandler,
  groupMessageHandler,
  messageDeliveryHandler,
  inviteGroupMemberHandler,
  acceptGroupInvitationHandler,
  rejectGroupInvitationHandler,
} from './handlers';

/**
 * Registers all WebSocket event handlers.
 */
export function registerEventHandlers() {
  const dispatcher = createEventDispatcher();

  dispatcher.register<PrivateMessageDto>(
    WS_CLIENT_EVENTS.SEND_PRIVATE_MESSAGE,
    privateMessageHandler
  );

  dispatcher.register<MessageDeliveryDto>(
    WS_CLIENT_EVENTS.MESSAGE_DELIVERED,
    messageDeliveryHandler
  );

  dispatcher.register<MessageDeliveryDto>(WS_CLIENT_EVENTS.MESSAGE_READ, messageDeliveryHandler);

  dispatcher.register<InviteGroupMemberDto>(
    WS_CLIENT_EVENTS.GROUP_INVITE_MEMBER,
    inviteGroupMemberHandler
  );

  dispatcher.register<GroupInvitationDto>(
    WS_CLIENT_EVENTS.GROUP_INVITATION_ACCEPT,
    acceptGroupInvitationHandler
  );

  dispatcher.register<GroupInvitationDto>(
    WS_CLIENT_EVENTS.GROUP_INVITATION_REJECT,
    rejectGroupInvitationHandler
  );

  dispatcher.register<GroupMessageDto>(WS_CLIENT_EVENTS.SEND_GROUP_MESSAGE, groupMessageHandler);

  return dispatcher;
}
