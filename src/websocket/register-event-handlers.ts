import { createEventDispatcher } from './dispatcher';
import { WS_CLIENT_EVENTS } from '@constants';

import {
  PrivateMessageDto,
  MessageDeliveryDto,
  InviteGroupMemberDto,
  GroupInvitationDto,
  GroupMessageDto,
  TypingDto,
  CallInitDto,
  CallReferenceDto,
  CallSdpDto,
  CallIceCandidateDto,
  CallSignalAckDto,
  CallNegotiationInitDto,
  CallRecoveredDto,
  CallSyncDto,
} from '@dtos';

import {
  privateMessageHandler,
  groupMessageHandler,
  messageDeliveryHandler,
  inviteGroupMemberHandler,
  acceptGroupInvitationHandler,
  rejectGroupInvitationHandler,
  typingStartHandler,
  callInitHandler,
  callAcceptHandler,
  callRejectHandler,
  callEndHandler,
  callOfferHandler,
  callAnswerHandler,
  callIceCandidateHandler,
  callTimeoutHandler,
  callSignalAckHandler,
  callConnectedHandler,
  callNegotiationInitHandler,
  callRecoveredHandler,
  callSyncHandler,
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
  dispatcher.register<TypingDto>(WS_CLIENT_EVENTS.TYPING_START, typingStartHandler);
  dispatcher.register<TypingDto>(WS_CLIENT_EVENTS.TYPING_STOP, typingStartHandler);

  // Call events
  dispatcher.register<CallInitDto>(WS_CLIENT_EVENTS.CALL_INIT, callInitHandler);
  dispatcher.register<CallReferenceDto>(WS_CLIENT_EVENTS.CALL_ACCEPT, callAcceptHandler);
  dispatcher.register<CallReferenceDto>(WS_CLIENT_EVENTS.CALL_REJECT, callRejectHandler);
  dispatcher.register<CallReferenceDto>(WS_CLIENT_EVENTS.CALL_END, callEndHandler);
  dispatcher.register<CallSdpDto>(WS_CLIENT_EVENTS.CALL_OFFER, callOfferHandler);
  dispatcher.register<CallSdpDto>(WS_CLIENT_EVENTS.CALL_ANSWER, callAnswerHandler);
  dispatcher.register<CallSignalAckDto>(WS_CLIENT_EVENTS.CALL_SIGNAL_ACK, callSignalAckHandler);
  dispatcher.register<CallReferenceDto>(WS_CLIENT_EVENTS.CALL_TIMEOUT, callTimeoutHandler);
  dispatcher.register<CallReferenceDto>(WS_CLIENT_EVENTS.CALL_CONNECTED, callConnectedHandler);
  dispatcher.register<CallRecoveredDto>(WS_CLIENT_EVENTS.CALL_RECOVERED, callRecoveredHandler);
  dispatcher.register<CallSyncDto>(WS_CLIENT_EVENTS.CALL_SYNC, callSyncHandler);
  dispatcher.register<CallIceCandidateDto>(
    WS_CLIENT_EVENTS.CALL_ICE_CANDIDATE,
    callIceCandidateHandler
  );
  dispatcher.register<CallNegotiationInitDto>(
    WS_CLIENT_EVENTS.CALL_NEGOTIATION_INIT,
    callNegotiationInitHandler
  );

  return dispatcher;
}
