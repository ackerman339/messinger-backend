import { WebSocket } from 'ws';
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
  const payload = PrivateMessageSchema.parse(message.data);
  const senderId = connection.userId!;
  const { savedMessage, members, replayed } = await messageService.createPrivateMessage(
    senderId,
    payload
  );
  const data = messageService.serializeMessage(savedMessage, savedMessage.conversation);

  if (!replayed) {
    for (const member of members) {
      if (member.userId === senderId) continue;
      const connections = connectionManager
        .getUserConnections(member.userId)
        .filter((receiver) => receiver.socket.readyState === WebSocket.OPEN);
      for (const receiver of connections) {
        sendMessage(receiver, { type: WS_SERVER_EVENTS.NEW_MESSAGE, data });
      }
      if (connections.length === 0) {
        void pushNotificationService.sendToUser(member.userId, {
          title: savedMessage.senderName!,
          body: data.content,
          icon: '/pwa-192x192.png',
          data: { type: 'message', messageId: data.id, conversationId: data.conversationId },
        });
      }
    }
  }

  sendMessage(connection, {
    type: WS_SERVER_EVENTS.MESSAGE_SENT,
    requestId: message.requestId,
    data: {
      ...data,
      clientMessageId: payload.clientMessageId,
      deliveries: savedMessage.deliveries.map(({ userId, status }) => ({ userId, status })),
    },
  });
}
