import { Server } from 'node:http';
import { WebSocketServer } from 'ws';
import { logger } from '@config/logger';
import { authService, offlineSyncService } from '@services';
import { connectionManager } from './managers/connection-manager';
import { parseWsMessage } from './message-parser';
import { registerEventHandlers } from './register-event-handlers';
import { sendError } from './send-error';

export interface CreateWebSocketServerOptions {
  server: Server;
}

export function createWebSocketServer({ server }: CreateWebSocketServerOptions) {
  const { dispatch } = registerEventHandlers();
  const ws = new WebSocketServer({
    server,
  });

  ws.on('connection', async (socket, req) => {
    const connection = connectionManager.register(socket);

    logger.info(
      `[WS] Connection established (${connection.id}) - Active: ${connectionManager.count()}`
    );

    try {
      const { userId, sessionId } = await authService.authenticateWsConnection(req);
      connection.userId = userId;
      connection.sessionId = sessionId;
      connectionManager.attachUser(connection, userId);

      await offlineSyncService.syncPendingMessages(userId);
      await offlineSyncService.syncPendingGroupInvitations(userId);

      logger.info(`[WS] Authenticated connection (${connection.id}) user=${userId}`);
    } catch (error) {
      logger.error(error);
      sendError(connection, error);
    }

    socket.on('message', async (raw) => {
      try {
        const message = parseWsMessage(raw);
        await dispatch(connection, message);
      } catch (error) {
        logger.error(error);
        sendError(connection, error);
      }
    });

    socket.on('close', () => {
      connectionManager.unregister(connection.id);

      logger.info(
        `[WS] Connection closed (${connection.id}) - Active: ${connectionManager.count()}`
      );
    });

    socket.on('error', (error) => {
      logger.error(error);
    });
  });

  return ws;
}
