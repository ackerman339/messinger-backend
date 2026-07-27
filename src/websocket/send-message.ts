import { WebSocket } from 'ws';
import { WsServerMessage, Connection } from '@appTypes';

/**
 * Sends a message through an active WebSocket connection.
 */
export function sendMessage<T>(connection: Connection, message: WsServerMessage<T>): void {
  if (connection.socket.readyState !== WebSocket.OPEN) {
    return;
  }

  connection.socket.send(JSON.stringify(message));
}
