import { CallStatus } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';

import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';

type FailedCallData = {
  callId: string;
  callerId: string;
  calleeId: string;
  endedAt: Date;
};

export function notifyCallConnectionTimeout(call: FailedCallData) {
  for (const userId of [call.callerId, call.calleeId]) {
    const connections = connectionManager.getUserConnections(userId);

    for (const connection of connections) {
      sendMessage(connection, {
        type: WS_SERVER_EVENTS.CALL_END,
        data: {
          ...call,
          status: CallStatus.FAILED,
          reason: 'CONNECTION_TIMEOUT',
        },
      });
    }
  }
}
