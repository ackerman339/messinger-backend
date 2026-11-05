import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { CallReferenceDto, CallReferenceSchema } from '@dtos';
import { callService } from '@services';

import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';

export async function callRejectHandler({ connection, message }: WsHandlers<CallReferenceDto>) {
  requireAuthentication(connection);

  const userId = connection.userId;

  if (!userId) {
    return;
  }

  const { callId } = CallReferenceSchema.parse(message.data);

  const { call, changed } = await callService.reject(userId, callId);

  const data = {
    callId: call.id,
    callerId: call.callerId,
    calleeId: call.calleeId,
    status: call.status,
    endedAt: call.endedAt,
  };

  // Acknowledge retries only to the requesting connection.
  if (!changed) {
    const senderConnection = connectionManager
      .getUserConnections(userId)
      .find((candidate) => candidate.id === connection.id);

    if (senderConnection) {
      sendMessage(senderConnection, {
        type: WS_SERVER_EVENTS.CALL_REJECT,
        data,
      });
    }

    return;
  }

  // Notify participants even if the rejecting connection disconnected.
  for (const participantId of [call.callerId, call.calleeId]) {
    const connections = connectionManager.getUserConnections(participantId);

    for (const participantConnection of connections) {
      sendMessage(participantConnection, {
        type: WS_SERVER_EVENTS.CALL_REJECT,
        data,
      });
    }
  }
}
