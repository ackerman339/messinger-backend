import { Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { WS_SERVER_EVENTS, WS_CLIENT_EVENTS } from '@constants';
import { Connection, WsClientMessage } from '@appTypes';
import { logger } from '@config/logger';
import { authService, offlineSyncService } from '@services';
import { connectionManager } from './managers/connection-manager';
import { parseWsMessage } from './message-parser';
import { registerEventHandlers } from './register-event-handlers';
import { presenceHandler } from './handlers/presence-handler';
import { callDisconnectHandler } from './handlers/call-disconnect';
import { sendError } from './send-error';
import { sendMessage } from './send-message';

export interface CreateWebSocketServerOptions {
  server: Server;
}

interface HeartbeatWebSocket extends WebSocket {
  isAlive?: boolean;
}

const HEARTBEAT_INTERVAL = 30_000;

type WsAuthParams = {
  connection: Connection;
  socket: WebSocket;
  userId: string;
  sessionId: string;
};

async function authenticate({ connection, socket, userId, sessionId }: WsAuthParams) {
  // The socket may have closed during authentication.
  if (socket.readyState !== WebSocket.OPEN || connection.userId) {
    return;
  }

  connectionManager.attachUser(connection, userId);
  connection.sessionId = sessionId;

  sendMessage(connection, { type: WS_SERVER_EVENTS.WS_AUTHENTICATED, data: { userId } });

  try {
    await offlineSyncService.syncPendingMessages(userId, connection);
  } catch (error) {
    logger.error(error);
    socket.close(1011, 'Message sync failed');
    return;
  }
  await offlineSyncService.syncPendingGroupInvitations(userId);
  await presenceHandler({ userId, isConnected: true });

  // The socket may have closed while awaiting the previous operation.
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  logger.info(`[WS] Authenticated connection (${connection.id}) user=${userId}`);
}

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

    socket.on('error', (error) => {
      logger.error(error);
    });

    socket.on('close', async (code, reason) => {
      const userId = connection.userId;

      connectionManager.unregister(connection.id);
      if (userId) {
        const remaining = connectionManager.getUserConnections(userId);
        const cleanup = [callDisconnectHandler(userId, connection.id)];
        if (!remaining.length) cleanup.push(presenceHandler({ userId }));
        for (const result of await Promise.allSettled(cleanup)) {
          if (result.status === 'rejected') logger.error(result.reason);
        }
      }

      logger.info(
        `[WS] Connection closed (${connection.id}) ` +
          `code=${code} ` +
          `reason=${reason.toString()} ` +
          `Active: ${connectionManager.count()}`
      );
    });

    socket.on('message', async (raw) => {
      try {
        const message = parseWsMessage(raw) as WsClientMessage<{ accessToken: string }>;
        // If client responds with token, then authenticate connection
        if (message.type === WS_CLIENT_EVENTS.AUTH_TOKEN_SENT) {
          const result = await authService.getWsSession(message.data.accessToken);
          const { userId, sessionId } = result;
          await authenticate({ connection, socket, userId, sessionId });
          return;
        }
        await dispatch(connection, message);
      } catch (error) {
        logger.error(error);
        sendError(connection, error);
      }
    });

    try {
      const cookies = await authService.authenticateWsConnection(req);

      // Authenticate via cookies, if not request auth via socket.send
      if (cookies?.accessToken) {
        const result = await authService.getWsSession(cookies.accessToken);
        const { userId, sessionId } = result;
        await authenticate({ connection, socket, userId, sessionId });
      } else {
        socket.send(
          JSON.stringify({
            type: WS_SERVER_EVENTS.REQUEST_AUTH_TOKEN,
          })
        );
      }
    } catch (error) {
      logger.error(error);
      sendError(connection, error);
    }
  });

  /**
   * Stop heartbeat when WebSocket server is closed.
   */
  ws.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return ws;
}
