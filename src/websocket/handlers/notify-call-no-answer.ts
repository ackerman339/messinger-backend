import { pushNotificationService } from '@services';
import { logger } from '@config/logger';
import { CallStatus } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';

type MissedCallData = {
  callId: string;
  callerId: string;
  calleeId: string;
  endedAt: Date | null;
};

export function notifyCallNoAnswer(call: MissedCallData) {
  for (const userId of [call.callerId, call.calleeId]) {
    const connections = connectionManager.getUserConnections(userId);

    if (userId === call.calleeId && connections.length === 0) {
      void pushNotificationService
        .sendToUser(
          call.calleeId,
          {
            title: 'Llamada perdida',
            body: 'Tienes una llamada sin contestar en Messinger.',
            icon: '/pwa-192x192.png',
            data: {
              type: 'call-missed',
              callId: call.callId,
              callerId: call.callerId,
            },
          },
          {
            // Replace an incoming push still queued for this call.
            topic: call.callId.replaceAll('-', ''),
          }
        )
        .catch(() => {
          logger.warn('[call-push] Failed to send missed call notification.', {
            callId: call.callId,
          });
        });
    }

    for (const connection of connections) {
      sendMessage(connection, {
        type: WS_SERVER_EVENTS.CALL_END,
        data: {
          ...call,
          status: CallStatus.MISSED,
          reason: 'NO_ANSWER',
        },
      });
    }
  }
}
