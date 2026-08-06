import { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '@config/logger';
import { authService, offlineSyncService } from '@services';
import { connectionManager } from './managers/connection-manager';
import { parseWsMessage } from './message-parser';
import { registerEventHandlers } from './register-event-handlers';
import { presenceOnlineHandler, presenceOfflineHandler } from './handlers/presence-handler';
import { sendError } from './send-error';

export interface CreateWebSocketServerOptions {
  server: Server;
}

interface HeartbeatWebSocket extends WebSocket {
  isAlive?: boolean;
}

const HEARTBEAT_INTERVAL = 30_000;

export function createWebSocketServer({ server }: CreateWebSocketServerOptions) {
  const { dispatch } = registerEventHandlers();

  const ws = new WebSocketServer({
    server,
  });

  /**
   * Heartbeat
   *
   * Every 30 seconds:
   *
   * 1. If the client didn't answer the previous ping,
   *    terminate the connection.
   *
   * 2. Otherwise mark it as waiting for a new pong
   *    and send another ping.
   */
  const heartbeatInterval = setInterval(() => {
    for (const socket of ws.clients as Set<HeartbeatWebSocket>) {
      if (socket.isAlive === false) {
        logger.warn('[WS] Terminating inactive connection');

        socket.terminate();
        continue;
      }

      socket.isAlive = false;
      socket.ping();
    }
  }, HEARTBEAT_INTERVAL);

  ws.on('connection', async (socket: HeartbeatWebSocket, req) => {
    socket.isAlive = true;

    socket.on('pong', () => {
      socket.isAlive = true;
    });

    const connection = connectionManager.register(socket);

    logger.info(
      `[WS] Connection established (${connection.id}) - Active: ${connectionManager.count()}`
    );

    try {
      const { userId, sessionId } = await authService.authenticateWsConnection(req);
      connection.userId = userId;
      connection.sessionId = sessionId;
      connectionManager.attachUser(connection, userId);

      presenceOnlineHandler(connection);

      await offlineSyncService.syncPendingMessages(userId);
      await offlineSyncService.syncPendingGroupInvitations(userId);

      logger.info(`[WS] Authenticated connection (${connection.id}) user=${userId}`);
    } catch (error) {
      logger.error(error);
      sendError(connection, error);

      /**
       * Authentication failed.
       *
       * Don't leave an unauthenticated socket alive.
       */
      socket.close(1008, 'Unauthorized');

      return;
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

    socket.on('close', (code, reason) => {
      const userId = connection.userId;
      const userConnections = userId ? connectionManager.getUserConnections(userId) : [];
      const wasLastConnection = Boolean(userId) && userConnections.length === 1;
      connectionManager.unregister(connection.id);

      if (wasLastConnection) {
        presenceOfflineHandler(connection);
      }

      logger.info(
        `[WS] Connection closed (${connection.id}) ` +
          `code=${code} ` +
          `reason=${reason.toString()} ` +
          `Active: ${connectionManager.count()}`
      );
    });

    socket.on('error', (error) => {
      logger.error(error);
    });
  });

  /**
   * Stop heartbeat when WebSocket server is closed.
   */
  ws.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return ws;
}
