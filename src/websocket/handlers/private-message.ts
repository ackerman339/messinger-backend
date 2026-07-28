import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { messageService } from '@services';
import { PrivateMessageSchema, PrivateMessageDto } from '@dtos';
import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../connection-manager';
import { sendMessage } from '../send-message';

export async function privateMessageHandler({
  connection,
  message,
}: WsHandlers<PrivateMessageDto>) {
  requireAuthentication(connection);

  const { receiverId, content } = PrivateMessageSchema.parse(message.data);
  const senderId = connection.userId;

  if (!senderId) {
    return;
  }

  const { savedMessage, members } = await messageService.createPrivateMessage(senderId, {
    receiverId,
    content,
  });

  //Deliver message to conversation members.
  for (const member of members) {
    //Do not send to sender connection.
    if (member.userId === senderId) {
      continue;
    }

    const connections = connectionManager.getUserConnections(member.userId);

    for (const receiverConnection of connections) {
      sendMessage(receiverConnection, {
        type: WS_SERVER_EVENTS.NEW_MESSAGE,
        data: {
          senderId,
          content,
          messageId: savedMessage.id,
          conversationId: savedMessage.conversationId,
          createdAt: savedMessage.createdAt,
        },
      });
    }
  }

  // Confirm persistence to sender.
  sendMessage(connection, {
    type: WS_SERVER_EVENTS.MESSAGE_SENT,
    data: {
      messageId: savedMessage.id,
      conversationId: savedMessage.conversationId,
    },
  });
}
