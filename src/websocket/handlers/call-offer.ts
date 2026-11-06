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

export async function callOfferHandler({ connection, message }: WsHandlers<CallSdpDto>) {
  requireAuthentication(connection);

  const userId = connection.userId;

  if (!userId) {
    return;
  }

  const { callId, sdp } = CallSdpSchema.parse(message.data);

  const route = await callService.offer(userId, connection.id, callId, sdp);

  // The connection may have closed while registering the offer.
  const isConnected = connectionManager
    .getUserConnections(userId)
    .some((candidate) => candidate.id === connection.id);

  if (!isConnected) {
    await callDisconnectHandler(userId, connection.id);
    return;
  }

  logger.info(
    `[CALL_OFFER] callId=${callId} ` +
      `sdpLength=${sdp.length} ` +
      `sdpBytes=${Buffer.byteLength(sdp, 'utf8')}`
  );

  const receiverConnection = connectionManager
    .getUserConnections(route.receiverId)
    .find((candidate) => candidate.id === route.receiverConnectionId);

  if (!receiverConnection) {
    throw new ForbiddenException('CALL_RECEIVER_NOT_CONNECTED');
  }

  // Identical retries are forwarded so a lost delivery can recover.
  sendMessage(receiverConnection, {
    type: WS_SERVER_EVENTS.CALL_OFFER,
    data: {
      callId: route.callId,
      signalId: route.signalId,
      sdp,
    },
  });
}
