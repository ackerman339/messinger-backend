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

  const call = await callService.reject(userId, callId);

  // Notify the caller and dismiss ringing on the callee's devices.
  for (const participantId of [call.callerId, call.calleeId]) {
    const connections = connectionManager.getUserConnections(participantId);

    for (const participantConnection of connections) {
      sendMessage(participantConnection, {
        type: WS_SERVER_EVENTS.CALL_REJECT,
        data: {
          callId: call.id,
          callerId: call.callerId,
          calleeId: call.calleeId,
          status: call.status,
          endedAt: call.endedAt,
        },
      });
    }
  }
}
