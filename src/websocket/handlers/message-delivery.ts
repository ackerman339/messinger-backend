import { MessageStatus, WsHandlers } from '@appTypes';
import { WS_CLIENT_EVENTS, WS_SERVER_EVENTS } from '@constants';
import { MessageDeliverySchema, MessageDeliveryDto } from '@dtos';
import { BadRequestException } from '@exceptions';
import { messageService } from '@services';
import { connectionManager } from '../managers/connection-manager';
import { requireAuthentication } from '../authenticate-guard';
import { sendMessage } from '../send-message';

export async function messageDeliveryHandler({
  connection,
  message,
}: WsHandlers<MessageDeliveryDto>) {
  requireAuthentication(connection);
  const validated = MessageDeliverySchema.parse(message.data);
  const expected =
    message.type === WS_CLIENT_EVENTS.MESSAGE_READ ? MessageStatus.READ : MessageStatus.DELIVERED;
  if (validated.status !== expected) throw new BadRequestException('MESSAGE:INVALID_RECEIPT_EVENT');
  const { delivery, changed } = await messageService.confirmDelivery(connection.userId!, validated);

  if (changed) {
    const data = { ...validated, userId: delivery.userId };
    for (const sender of connectionManager.getUserConnections(delivery.message.senderId)) {
      sendMessage(sender, { type: WS_SERVER_EVENTS.MESSAGE_STATUS_UPDATED, data });
    }
  }

  if (message.requestId) {
    sendMessage(connection, {
      type: WS_SERVER_EVENTS.MESSAGE_RECEIPT_CONFIRMED,
      requestId: message.requestId,
      data: validated,
    });
  }
}
