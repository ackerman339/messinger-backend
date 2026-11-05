import { Buffer } from 'node:buffer';
import { logger } from '@config/logger';
import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { CallSdpDto, CallSdpSchema } from '@dtos';
import { ForbiddenException } from '@exceptions';
import { callService } from '@services';

import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';
import { callDisconnectHandler } from './call-disconnect';

export async function callAnswerHandler({ connection, message }: WsHandlers<CallSdpDto>) {
  requireAuthentication(connection);

  const userId = connection.userId;

  if (!userId) {
    return;
  }

  const { callId, sdp } = CallSdpSchema.parse(message.data);

  const route = await callService.answer(userId, connection.id, callId);

  const isSenderConnected = connectionManager
    .getUserConnections(userId)
    .some((candidate) => candidate.id === connection.id);

  if (!isSenderConnected) {
    await callDisconnectHandler(userId, connection.id);
    return;
  }

  // Log size measurements without exposing SDP content.
  logger.info('[CALL_ANSWER] SDP size', {
    callId,
    sdpLength: sdp.length,
    sdpBytes: Buffer.byteLength(sdp, 'utf8'),
  });

  const receiverConnection = connectionManager
    .getUserConnections(route.receiverId)
    .find((candidate) => candidate.id === route.receiverConnectionId);

  if (!receiverConnection) {
    throw new ForbiddenException('CALL_RECEIVER_NOT_CONNECTED');
  }

  sendMessage(receiverConnection, {
    type: WS_SERVER_EVENTS.CALL_ANSWER,
    data: {
      callId: route.callId,
      sdp,
    },
  });
}
