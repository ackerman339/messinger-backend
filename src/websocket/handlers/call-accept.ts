import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { CallReferenceDto, CallReferenceSchema } from '@dtos';
import { callService } from '@services';

import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';
import { callDisconnectHandler } from './call-disconnect';

export async function callAcceptHandler({ connection, message }: WsHandlers<CallReferenceDto>) {
  requireAuthentication(connection);

  const userId = connection.userId;

  if (!userId) {
    return;
  }

  const { callId } = CallReferenceSchema.parse(message.data);

  const { call, changed } = await callService.accept(userId, connection.id, callId);

  // The connection may have closed while persisting acceptance.
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
    acceptedAt: call.acceptedAt,
    connectionExpiresAt: call.connectionExpiresAt,
  };

  // Acknowledge the retry without restarting negotiation.
  if (!changed) {
    sendMessage(connection, {
      type: WS_SERVER_EVENTS.CALL_ACCEPT,
      data: {
        ...data,
        isSelectedConnection: true,
        shouldCreateOffer: false,
      },
    });

    return;
  }

  for (const participantId of [call.callerId, call.calleeId]) {
    const isCaller = participantId === call.callerId;
    const selectedConnectionId = isCaller ? call.callerConnectionId : call.calleeConnectionId;
    const connections = connectionManager.getUserConnections(participantId);

    for (const participantConnection of connections) {
      const isSelectedConnection = participantConnection.id === selectedConnectionId;

      sendMessage(participantConnection, {
        type: WS_SERVER_EVENTS.CALL_ACCEPT,
        data: {
          ...data,
          isSelectedConnection,
          shouldCreateOffer: isCaller && isSelectedConnection,
        },
      });
    }
  }
}
