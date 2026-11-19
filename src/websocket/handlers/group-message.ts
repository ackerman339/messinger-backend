import { WebSocket } from 'ws';
import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { GroupMessageDto, GroupMessageSchema, PushNotificationPayload } from '@dtos';
import { messageService, pushNotificationService } from '@services';
import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';

export async function groupMessageHandler({ connection, message }: WsHandlers<GroupMessageDto>) {
  requireAuthentication(connection);

  const payload = GroupMessageSchema.parse(message.data);
  const { conversationId, clientMessageId } = payload;
  const senderId = connection.userId!;

  const { savedMessage, members, groupName, senderName, replayed } =
    await messageService.createGroupMessage(senderId, payload);

  const data = {
    id: savedMessage.id,
    senderId,
    type: 'MESSAGE' as const,
    messageId: savedMessage.id,
    conversationId,
    content: savedMessage.content,
    createdAt: savedMessage.createdAt,
    attachments: savedMessage.savedAttachments,
  };
  if (!replayed) {
    const previewLimit = 200;
    const text = data.content.trim();
    const characters = Array.from(text);
    const preview =
      characters.length > previewLimit ? `${characters.slice(0, previewLimit).join('')}…` : text;
    const body = preview || (data.attachments.length ? 'Archivo adjunto' : 'Nuevo mensaje');
    const notification: PushNotificationPayload = {
      title: groupName?.trim() || 'Grupo',
      body: `${senderName}: ${body}`,
      icon: '/pwa-192x192.png',
      data: { type: 'message', messageId: data.messageId, conversationId },
    };

    for (const member of members) {
      if (member.userId === senderId) {
        continue;
      }

      const connections = connectionManager
        .getUserConnections(member.userId)
        .filter((receiver) => receiver.socket.readyState === WebSocket.OPEN);

      if (connections.length === 0) {
        void pushNotificationService.sendToUser(member.userId, notification);
      }

      for (const receiver of connections) {
        sendMessage(receiver, {
          type: WS_SERVER_EVENTS.NEW_MESSAGE,
          data,
        });
      }
    }
  }
  sendMessage(connection, {
    type: WS_SERVER_EVENTS.MESSAGE_SENT,
    requestId: message.requestId,
    data: {
      ...data,
      clientMessageId,
      deliveries: savedMessage.deliveries?.map(({ userId, status }) => ({ userId, status })) ?? [],
    },
  });
}
