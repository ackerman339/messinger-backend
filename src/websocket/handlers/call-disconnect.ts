import { CallStatus } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { callService } from '@services';

import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';

export async function callDisconnectHandler(userId: string, connectionId: string) {
  const calls = await callService.disconnect(userId, connectionId);

  for (const call of calls) {
    for (const participantId of [call.callerId, call.calleeId]) {
      const connections = connectionManager.getUserConnections(participantId);

      for (const connection of connections) {
        sendMessage(connection, {
          type: WS_SERVER_EVENTS.CALL_END,
          data: {
            ...call,
            status: CallStatus.ENDED,
            reason: 'PARTICIPANT_DISCONNECTED',
            endedBy: userId,
          },
        });
      }
    }
  }
}
