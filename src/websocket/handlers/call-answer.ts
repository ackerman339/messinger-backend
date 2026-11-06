import { Buffer } from 'node:buffer';
import { logger } from '@config/logger';
import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { CallSdpDto, CallSdpSchema } from '@dtos';
import { callNegotiationService } from '@services';

import { resolveCallSignalReceiver } from './foward-call-signal';
import { requireAuthentication } from '../authenticate-guard';
import { sendMessage } from '../send-message';

export async function callAnswerHandler({ connection, message }: WsHandlers<CallSdpDto>) {
  requireAuthentication(connection);

  const userId = connection.userId;

  if (!userId) {
    return;
  }

  const data = CallSdpSchema.parse(message.data);

  const route = await callNegotiationService.answer(userId, connection.id, data);

  const receiver = await resolveCallSignalReceiver(connection, userId, route);

  if (!receiver) {
    return;
  }

  logger.info(
    `[CALL_ANSWER] callId=${route.callId} ` +
      `negotiationId=${route.negotiationId} ` +
      `sdpLength=${data.sdp.length} ` +
      `sdpBytes=${Buffer.byteLength(data.sdp, 'utf8')}`
  );

  sendMessage(receiver, {
    type: WS_SERVER_EVENTS.CALL_ANSWER,
    data: {
      callId: route.callId,
      negotiationId: route.negotiationId,
      signalId: route.signalId,
      sdp: data.sdp,
    },
  });
}
