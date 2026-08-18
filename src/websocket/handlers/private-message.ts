import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { messageService, pushNotificationService } from '@services';
import { PrivateMessageSchema, PrivateMessageDto } from '@dtos';
import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';

export async function privateMessageHandler({
  connection,
  message,
}: WsHandlers<PrivateMessageDto>) {
  requireAuthentication(connection);

  let data = {};

  const { receiverId, content, attachments } = PrivateMessageSchema.parse(message.data);
  const senderId = connection.userId;

  if (!senderId) {
    return;
  }

  const { savedMessage, members } = await messageService.createPrivateMessage(senderId, {
    receiverId,
    content,
    attachments,
  });

  // Deliver message to conversation members.
  for (const member of members) {
    // Do not send to sender connection.
    if (member.userId === senderId) {
      continue;
    }

    const connections = connectionManager.getUserConnections(member.userId);
    data = {
      senderId,
      content,
      messageId: savedMessage.id,
      conversation: {
        ...savedMessage.conversation,
        lastMessage: savedMessage,
        members: savedMessage.conversation.members.map((member) => ({
          userId: member.user.id,
          username: member.user.username,
          lastSeenAt: member.user.lastSeenAt,
          unreadCount: member.unreadCount,
        })),
      },
      createdAt: savedMessage.createdAt,
      attachments: savedMessage.savedAttachments,
    };

    // User is connected through WebSocket.
    for (const receiverConnection of connections) {
      sendMessage(receiverConnection, {
        type: WS_SERVER_EVENTS.NEW_MESSAGE,
        data,
      });
    }

    // User is not connected through WebSocket.
    if (connections.length === 0) {
      void pushNotificationService.sendToUser(member.userId, {
        title: savedMessage.senderName!,
        body: content,
        icon: '/pwa-192x192.png',
        data: {
          messageId: savedMessage.id,
          conversationId: savedMessage.conversation.id,
        },
      });
    }
  }

  // Confirm persistence to sender.
  sendMessage(connection, {
    type: WS_SERVER_EVENTS.MESSAGE_SENT,
    data,
  });
}
