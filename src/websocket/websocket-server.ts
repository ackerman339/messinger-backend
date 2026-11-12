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
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  connectionManager.attachUser(connection, userId);
  connection.sessionId = sessionId;

  await offlineSyncService.syncPendingMessages(userId);
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

      if (userId) {
        await presenceHandler({ userId });
        await callDisconnectHandler(userId, connection.id);
        connectionManager.unregister(connection.id);
      }

      logger.info(
        `[WS] Connection closed (${connection.id}) ` +
          `code=${code} ` +
          `reason=${reason.toString()} ` +
          `Active: ${connectionManager.count()}`
      );
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

    socket.on('message', async (raw) => {
      const message = parseWsMessage(raw) as WsClientMessage<{ accessToken: string }>;

      try {
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
  });

  /**
   * Stop heartbeat when WebSocket server is closed.
   */
  ws.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return ws;
}
