import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { CallInitDto, CallInitSchema } from '@dtos';
import { callService } from '@services';

import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';

export async function callInitHandler({ connection, message }: WsHandlers<CallInitDto>) {
  requireAuthentication(connection);

  const callerId = connection.userId;

  if (!callerId) {
    return;
  }

  const data = CallInitSchema.parse(message.data);
  const call = await callService.init(callerId, connection.id, data);

  // Confirm creation before notifying the callee.
  sendMessage(connection, {
    type: WS_SERVER_EVENTS.CALL_CREATED,
    data: {
      callId: call.id,
      calleeId: call.calleeId,
      media: call.media,
      status: call.status,
      createdAt: call.createdAt,
    },
  });

  const connections = connectionManager.getUserConnections(call.calleeId);

  for (const receiverConnection of connections) {
    sendMessage(receiverConnection, {
      type: WS_SERVER_EVENTS.CALL_INCOMING,
      data: {
        callId: call.id,
        callerId: call.callerId,
        media: call.media,
        createdAt: call.createdAt,
      },
    });
  }
}
