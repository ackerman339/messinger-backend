import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { CallSyncDto, CallSyncSchema } from '@dtos';
import { callService } from '@services';

import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';

export async function callSyncHandler({ connection, message }: WsHandlers<CallSyncDto>) {
  requireAuthentication(connection);

  const userId = connection.userId;

  if (!userId) {
    return;
  }

  const data = CallSyncSchema.parse(message.data);
  const state = await callService.sync(userId, connection.id, data);

  // The connection may have closed while reading the state.
  const isConnected = connectionManager
    .getUserConnections(userId)
    .some((candidate) => candidate.id === connection.id);

  if (!isConnected) {
    return;
  }

  sendMessage(connection, {
    type: WS_SERVER_EVENTS.CALL_STATE,
    data: {
      syncId: data.syncId,
      ...state,
    },
  });
}
