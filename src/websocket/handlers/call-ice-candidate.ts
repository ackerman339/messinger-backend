import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { CallIceCandidateDto, CallIceCandidateSchema } from '@dtos';
import { ForbiddenException } from '@exceptions';
import { callService } from '@services';

import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';
import { callDisconnectHandler } from './call-disconnect';

export async function callIceCandidateHandler({
  connection,
  message,
}: WsHandlers<CallIceCandidateDto>) {
  requireAuthentication(connection);

  const userId = connection.userId;

  if (!userId) {
    return;
  }

  const { callId, candidate } = CallIceCandidateSchema.parse(message.data);

  const route = await callService.iceCandidate(userId, connection.id, callId);

  const isSenderConnected = connectionManager
    .getUserConnections(userId)
    .some((candidate) => candidate.id === connection.id);

  if (!isSenderConnected) {
    await callDisconnectHandler(userId, connection.id);
    return;
  }

  const receiverConnection = connectionManager
    .getUserConnections(route.receiverId)
    .find((connection) => connection.id === route.receiverConnectionId);

  if (!receiverConnection) {
    throw new ForbiddenException('CALL_RECEIVER_NOT_CONNECTED');
  }

  sendMessage(receiverConnection, {
    type: WS_SERVER_EVENTS.CALL_ICE_CANDIDATE,
    data: {
      callId: route.callId,
      candidate,
    },
  });
}
