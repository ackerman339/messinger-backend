import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { CallRecoveredDto, CallRecoveredSchema } from '@dtos';
import { callNegotiationService } from '@services';

import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';
import { callDisconnectHandler } from './call-disconnect';

export async function callRecoveredHandler({ connection, message }: WsHandlers<CallRecoveredDto>) {
  requireAuthentication(connection);

  const userId = connection.userId;

  if (!userId) {
    return;
  }

  const payload = CallRecoveredSchema.parse(message.data);

  const { call, negotiation, becameRecovered } = await callNegotiationService.recovered(
    userId,
    connection.id,
    payload
  );

  // The connection may have closed while recording recovery.
  const isConnected = connectionManager
    .getUserConnections(userId)
    .some((candidate) => candidate.id === connection.id);

  if (!isConnected) {
    await callDisconnectHandler(userId, connection.id);
    return;
  }

  const data = {
    callId: call.id,
    negotiationId: negotiation.id,
    callerRecoveredAt: negotiation.callerRecoveredAt,
    calleeRecoveredAt: negotiation.calleeRecoveredAt,
    recoveredAt: negotiation.recoveredAt,
    recoveryExpiresAt: call.recoveryExpiresAt,
  };

  if (!becameRecovered) {
    sendMessage(connection, {
      type: WS_SERVER_EVENTS.CALL_RECOVERED,
      data,
    });

    return;
  }

  for (const participantId of [call.callerId, call.calleeId]) {
    const connections = connectionManager.getUserConnections(participantId);

    for (const participantConnection of connections) {
      sendMessage(participantConnection, {
        type: WS_SERVER_EVENTS.CALL_RECOVERED,
        data,
      });
    }
  }
}
