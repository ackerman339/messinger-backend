import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { CallSignalAckDto, CallSignalAckSchema } from '@dtos';
import { ForbiddenException } from '@exceptions';
import { callService } from '@services';

import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';
import { callDisconnectHandler } from './call-disconnect';

export async function callSignalAckHandler({ connection, message }: WsHandlers<CallSignalAckDto>) {
  requireAuthentication(connection);

  const userId = connection.userId;

  if (!userId) {
    return;
  }

  const data = CallSignalAckSchema.parse(message.data);

  const route = await callService.acknowledgeSignal(userId, connection.id, data);

  // The connection may have closed while validating the ACK.
  const isConnected = connectionManager
    .getUserConnections(userId)
    .some((candidate) => candidate.id === connection.id);

  if (!isConnected) {
    await callDisconnectHandler(userId, connection.id);
    return;
  }

  const receiverConnection = connectionManager
    .getUserConnections(route.receiverId)
    .find((candidate) => candidate.id === route.receiverConnectionId);

  if (!receiverConnection) {
    throw new ForbiddenException('CALL_RECEIVER_NOT_CONNECTED');
  }

  sendMessage(receiverConnection, {
    type: WS_SERVER_EVENTS.CALL_SIGNAL_ACK,
    data: {
      callId: route.callId,
      signalType: route.signalType,
      signalId: route.signalId,
    },
  });
}
