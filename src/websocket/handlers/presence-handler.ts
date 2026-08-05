import { Connection } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { userService } from '@services';
import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';

export function presenceOnlineHandler(connection: Connection) {
  requireAuthentication(connection);

  const userId = connection.userId;

  if (!userId) {
    return;
  }

  for (const receiverConnection of connectionManager.getAllConnections()) {
    if (receiverConnection.id === connection.id) {
      continue;
    }

    sendMessage(receiverConnection, {
      type: WS_SERVER_EVENTS.PRESENCE_ONLINE,
      data: {
        userId,
      },
    });
  }
}

export async function presenceOfflineHandler(connection: Connection) {
  requireAuthentication(connection);
  const userId = connection.userId;

  if (!userId) {
    return;
  }

  const lastSeenAt = await userService.updateLastSeenAt(userId);

  for (const receiverConnection of connectionManager.getAllConnections()) {
    sendMessage(receiverConnection, {
      type: WS_SERVER_EVENTS.PRESENCE_OFFLINE,
      data: {
        userId,
        lastSeenAt,
      },
    });
  }
}
