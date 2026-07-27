import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { SendMessageWsSchema, SendMessageWsDto } from '@dtos';
import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../connection-manager';
import { sendMessage } from '../send-message';

export async function sendMessageHandler({ connection, message }: WsHandlers<SendMessageWsDto>) {
  requireAuthentication(connection);

  const validated = SendMessageWsSchema.parse(message.data);
  const senderId = connection.userId;

  if (!senderId) {
    return;
  }

  const receiverConnections = connectionManager.getUserConnections(validated.receiverId);

  for (const receiverConnection of receiverConnections) {
    sendMessage(receiverConnection, {
      type: WS_SERVER_EVENTS.NEW_MESSAGE,
      data: {
        senderId,
        content: validated.content,
      },
    });
  }

  sendMessage(connection, {
    type: WS_SERVER_EVENTS.MESSAGE_SENT,
    data: {
      receiverId: validated.receiverId,
      content: validated.content,
    },
  });
}
