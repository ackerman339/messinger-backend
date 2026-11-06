import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { CallReferenceDto, CallReferenceSchema } from '@dtos';
import { callService } from '@services';

import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';
import { callDisconnectHandler } from './call-disconnect';

export async function callConnectedHandler({ connection, message }: WsHandlers<CallReferenceDto>) {
  requireAuthentication(connection);

  const userId = connection.userId;

  if (!userId) {
    return;
  }

  const { callId } = CallReferenceSchema.parse(message.data);

  const { call, becameConnected } = await callService.connected(userId, connection.id, callId);

  // The connection may have closed while recording the report.
  const isConnected = connectionManager
    .getUserConnections(userId)
    .some((candidate) => candidate.id === connection.id);

  if (!isConnected) {
    await callDisconnectHandler(userId, connection.id);
    return;
  }

  const data = {
    callId: call.id,
    callerId: call.callerId,
    calleeId: call.calleeId,
    status: call.status,
    callerConnectedAt: call.callerConnectedAt,
    calleeConnectedAt: call.calleeConnectedAt,
    connectedAt: call.connectedAt,
    connectionExpiresAt: call.connectionExpiresAt,
  };

  // Acknowledge partial reports and retries only to the sender.
  if (!becameConnected) {
    sendMessage(connection, {
      type: WS_SERVER_EVENTS.CALL_CONNECTED,
      data,
    });

    return;
  }

  // Both participants reported connection; synchronize all devices.
  for (const participantId of [call.callerId, call.calleeId]) {
    const connections = connectionManager.getUserConnections(participantId);

    for (const participantConnection of connections) {
      sendMessage(participantConnection, {
        type: WS_SERVER_EVENTS.CALL_CONNECTED,
        data,
      });
    }
  }
}
