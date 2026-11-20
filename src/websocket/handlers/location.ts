import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import {
  LocationReferenceDto,
  LocationReferenceSchema,
  LocationUpdateDto,
  LocationUpdateSchema,
} from '@dtos';
import { messageService } from '@services';
import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';

function broadcast(result: Awaited<ReturnType<typeof messageService.updateLiveLocation>>) {
  if (!result) return;
  for (const userId of result.memberIds) {
    for (const connection of connectionManager.getUserConnections(userId)) {
      sendMessage(connection, { type: WS_SERVER_EVENTS.LOCATION_UPDATED, data: result.data });
    }
  }
}

export async function locationUpdateHandler({
  connection,
  message,
}: WsHandlers<LocationUpdateDto>) {
  requireAuthentication(connection);
  const { messageId, point } = LocationUpdateSchema.parse(message.data);
  broadcast(await messageService.updateLiveLocation(connection.userId!, messageId, point));
}

export async function locationStopHandler({
  connection,
  message,
}: WsHandlers<LocationReferenceDto>) {
  requireAuthentication(connection);
  const { messageId } = LocationReferenceSchema.parse(message.data);
  broadcast(await messageService.updateLiveLocation(connection.userId!, messageId));
  sendMessage(connection, {
    type: WS_SERVER_EVENTS.LOCATION_STOP_CONFIRMED,
    requestId: message.requestId,
    data: { messageId },
  });
}
