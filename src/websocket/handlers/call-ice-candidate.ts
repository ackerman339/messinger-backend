import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { CallIceCandidateDto, CallIceCandidateSchema } from '@dtos';
import { callNegotiationService } from '@services';

import { resolveCallSignalReceiver } from './foward-call-signal';
import { requireAuthentication } from '../authenticate-guard';
import { sendMessage } from '../send-message';

export async function callIceCandidateHandler({
  connection,
  message,
}: WsHandlers<CallIceCandidateDto>) {
  requireAuthentication(connection);

  const userId = connection.userId;

  if (!userId) {
    return;
  }

  const data = CallIceCandidateSchema.parse(message.data);
  const route = await callNegotiationService.iceCandidate(userId, connection.id, data);
  const receiver = await resolveCallSignalReceiver(connection, userId, route);

  if (!receiver) {
    return;
  }

  sendMessage(receiver, {
    type: WS_SERVER_EVENTS.CALL_ICE_CANDIDATE,
    data: {
      callId: route.callId,
      negotiationId: route.negotiationId,
      candidate: data.candidate,
    },
  });
}
