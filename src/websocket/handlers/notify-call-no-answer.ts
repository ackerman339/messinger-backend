import { pushNotificationService } from '@services';
import { CallStatus } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';

type MissedCallData = {
  callId: string;
  callerId: string;
  callerName: string | null;
  calleeId: string;
  endedAt: Date | null;
};

export function notifyCallNoAnswer(call: MissedCallData) {
  const callerName = call.callerName?.trim() || 'Usuario desconocido';
  for (const userId of [call.callerId, call.calleeId]) {
    const connections = connectionManager.getUserConnections(userId);

    if (userId === call.calleeId) {
      void pushNotificationService.sendToUser(
        call.calleeId,
        {
          title: `Llamada perdida de ${callerName}`,
          body: 'Tienes una llamada sin contestar en Messinger.',
          icon: '/pwa-192x192.png',
          data: {
            type: 'call-missed',
            callId: call.callId,
            callerId: call.callerId,
            callerName,
          },
        },
        {
          // Replace an incoming push still queued for this call.
          topic: call.callId.replaceAll('-', ''),
        }
      );
    }

    for (const connection of connections) {
      sendMessage(connection, {
        type: WS_SERVER_EVENTS.CALL_END,
        data: {
          ...call,
          callerName,
          status: CallStatus.MISSED,
          reason: 'NO_ANSWER',
        },
      });
    }
  }
}
