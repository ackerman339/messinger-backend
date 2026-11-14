import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { CallInitDto, CallInitSchema } from '@dtos';
import { callService, pushNotificationService } from '@services';

import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';
import { callDisconnectHandler } from './call-disconnect';

export async function callInitHandler({ connection, message }: WsHandlers<CallInitDto>) {
  requireAuthentication(connection);

  const callerId = connection.userId;

  if (!callerId) {
    return;
  }

  const data = CallInitSchema.parse(message.data);
  const { call, created } = await callService.init(callerId, connection.id, data);

  // Keep the existing post-await connection check here.

  const isConnected = connectionManager
    .getUserConnections(callerId)
    .some((candidate) => candidate.id === connection.id);

  if (!isConnected) {
    await callDisconnectHandler(callerId, connection.id);
    return;
  }

  // Confirm creation before notifying the callee.
  sendMessage(connection, {
    type: WS_SERVER_EVENTS.CALL_CREATED,
    data: {
      callId: call.id,
      calleeId: call.calleeId,
      media: call.media,
      status: call.status,
      createdAt: call.createdAt,
      expiresAt: call.expiresAt,
    },
  });

  if (!created) {
    return;
  }

  const connections = connectionManager.getUserConnections(call.calleeId);

  // A socket may belong to another device or remain registered while Android suspends the app.
  // Push and WebSocket deliver the same callId; each client deduplicates its presentation.
  void pushNotificationService.sendToUser(
    call.calleeId,
    {
      title: 'Llamada entrante',
      body:
        call.media === 'video'
          ? 'Tienes una videollamada entrante.'
          : 'Tienes una llamada de voz entrante.',
      icon: '/pwa-192x192.png',
      data: {
        type: 'call-incoming',
        callId: call.id,
        callerId: call.callerId,
        media: call.media,
        expiresAt: call.expiresAt?.toISOString() ?? null,
      },
    },
    {
      TTL: call.expiresAt
        ? Math.max(0, Math.ceil((call.expiresAt.getTime() - Date.now()) / 1000))
        : 0,
      urgency: 'high',
      topic: call.id.replaceAll('-', ''),
    }
  );

  for (const receiverConnection of connections) {
    sendMessage(receiverConnection, {
      type: WS_SERVER_EVENTS.CALL_INCOMING,
      data: {
        callId: call.id,
        callerId: call.callerId,
        media: call.media,
        createdAt: call.createdAt,
        expiresAt: call.expiresAt,
      },
    });
  }
}
