import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { MessageDeliverySchema, MessageDeliveryDto } from '@dtos';
import { messageService } from '@services';
import { connectionManager } from '../connection-manager';
import { requireAuthentication } from '../authenticate-guard';
import { sendMessage } from '../send-message';

export async function messageDeliveryHandler({
  connection,
  message,
}: WsHandlers<MessageDeliveryDto>) {
  requireAuthentication(connection);

  const validated = MessageDeliverySchema.parse(message.data);
  const delivery = await messageService.confirmDelivery(connection.userId!, {
    ...validated,
  });

  // Notify sender.
  const senderConnections = connectionManager.getUserConnections(delivery.message.senderId);

  for (const senderConnection of senderConnections) {
    sendMessage(senderConnection, {
      type: WS_SERVER_EVENTS.MESSAGE_STATUS_UPDATED,
      data: {
        messageId: delivery.messageId,
        userId: delivery.userId,
        status: validated.status,
      },
    });
  }
}
