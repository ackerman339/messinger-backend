import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { CallNegotiationInitDto, CallNegotiationInitSchema } from '@dtos';
import { callNegotiationService } from '@services';

import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';
import { callDisconnectHandler } from './call-disconnect';

export async function callNegotiationInitHandler({
  connection,
  message,
}: WsHandlers<CallNegotiationInitDto>) {
  requireAuthentication(connection);

  const userId = connection.userId;

  if (!userId) {
    return;
  }

  const data = CallNegotiationInitSchema.parse(message.data);

  const { negotiation, created, recoveryExpiresAt } = await callNegotiationService.init(
    userId,
    connection.id,
    data
  );

  // The connection may have closed while creating the negotiation.
  const isConnected = connectionManager
    .getUserConnections(userId)
    .some((candidate) => candidate.id === connection.id);

  if (!isConnected) {
    await callDisconnectHandler(userId, connection.id);
    return;
  }

  sendMessage(connection, {
    type: WS_SERVER_EVENTS.CALL_NEGOTIATION_CREATED,
    data: {
      requestId: negotiation.requestId,
      callId: negotiation.callId,
      negotiationId: negotiation.id,
      offererId: negotiation.offererId,
      type: negotiation.type,
      status: negotiation.status,
      createdAt: negotiation.createdAt,
      expiresAt: negotiation.expiresAt,
      recoveryExpiresAt,
      created,
    },
  });
}
