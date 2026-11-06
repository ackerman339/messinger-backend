import { Connection } from '@appTypes';
import { ForbiddenException } from '@exceptions';
import { connectionManager } from '../managers/connection-manager';
import { callDisconnectHandler } from '../handlers/call-disconnect';

type SignalRoute = {
  receiverId: string;
  receiverConnectionId: string;
};

export async function resolveCallSignalReceiver(
  connection: Connection,
  userId: string,
  route: SignalRoute
) {
  // The connection may have closed during the database operation.
  const isConnected = connectionManager
    .getUserConnections(userId)
    .some((candidate) => candidate.id === connection.id);

  if (!isConnected) {
    await callDisconnectHandler(userId, connection.id);
    return null;
  }

  const receiverConnection = connectionManager
    .getUserConnections(route.receiverId)
    .find((candidate) => candidate.id === route.receiverConnectionId);

  if (!receiverConnection) {
    throw new ForbiddenException('CALL_RECEIVER_NOT_CONNECTED');
  }

  return receiverConnection;
}
