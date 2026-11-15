import { WS_SERVER_EVENTS } from '@constants';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';

export function notifyCallHistoryDeleted(userId: string, callId?: string) {
  for (const connection of connectionManager.getUserConnections(userId)) {
    sendMessage(connection, {
      type: WS_SERVER_EVENTS.CALL_HISTORY_DELETED,
      data: { callId },
    });
  }
}
