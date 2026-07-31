import { WebSocket } from 'ws';
import { Connection } from '@appTypes';
import { logger } from '@config/logger';

/**
 * Manages active WebSocket connections.
 *
 * Responsibilities:
 * - Register and remove socket connections.
 * - Associate connections with authenticated users.
 * - Resolve all active connections of a user.
 *
 * A user can have multiple active connections:
 * - Browser
 * - Mobile device
 * - Desktop application
 */
export function createConnectionManager() {
  /**
   * Stores all active connections by connection id.
   *
   * Example:
   * connectionId -> Connection
   */
  const connections = new Map<string, Connection>();

  /**
   * Stores authenticated connections grouped by user.
   *
   * Example:
   * userId -> Set<connectionId>
   *
   * A Set is used to avoid duplicated connections.
   */
  const userConnections = new Map<string, Set<string>>();

  /**
   * Creates and stores a new unauthenticated connection.
   */
  function register(socket: WebSocket): Connection {
    const connection: Connection = {
      id: crypto.randomUUID(),
      socket,
      connectedAt: new Date(),
      userId: null,
      sessionId: null,
    };

    connections.set(connection.id, connection);

    return connection;
  }

  /**
   * Removes a connection from the manager.
   *
   * If the connection belongs to an authenticated user,
   * it is also removed from the user's active connections.
   */
  function unregister(connectionId: string): void {
    const connection = connections.get(connectionId);

    if (!connection) {
      return;
    }

    if (connection.userId) {
      removeUserConnection(connection.userId, connection.id);
    }

    connections.delete(connectionId);
  }

  /**
   * Associates an authenticated connection with a user.
   *
   * This is called after successful authentication.
   *
   * A user can have multiple connections simultaneously.
   */
  function attachUser(connection: Connection, userId: string): void {
    connection.userId = userId;

    const userConnectionIds = userConnections.get(userId) ?? new Set<string>();

    userConnectionIds.add(connection.id);
    userConnections.set(userId, userConnectionIds);
    logger.info({
      userId,
      connectionId: connection.id,
    });
  }

  /**
   * Removes a connection from a user's active sessions.
   *
   * When the user has no more active connections,
   * the user entry is removed completely.
   */
  function removeUserConnection(userId: string, connectionId: string): void {
    const userConnectionIds = userConnections.get(userId);

    if (!userConnectionIds) {
      return;
    }

    userConnectionIds.delete(connectionId);

    if (userConnectionIds.size === 0) {
      userConnections.delete(userId);
    }
  }

  /**
   * Returns all active connections of a user.
   *
   * Used for:
   * - Sending messages to all user devices.
   * - Presence detection.
   * - WebRTC signaling.
   */
  function getUserConnections(userId: string): Connection[] {
    const connectionIds = userConnections.get(userId);

    if (!connectionIds) {
      return [];
    }

    return Array.from(connectionIds)
      .map((id) => connections.get(id))
      .filter(Boolean) as Connection[];
  }

  /**
   * Returns total active WebSocket connections.
   */
  function count(): number {
    return connections.size;
  }

  return {
    register,
    unregister,
    attachUser,
    getUserConnections,
    count,
  };
}

export const connectionManager = createConnectionManager();
