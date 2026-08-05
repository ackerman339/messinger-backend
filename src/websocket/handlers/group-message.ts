import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { GroupMessageDto, GroupMessageSchema } from '@dtos';
import { messageService } from '@services';
import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';

export async function groupMessageHandler({ connection, message }: WsHandlers<GroupMessageDto>) {
  requireAuthentication(connection);

  const { conversationId, content, attachments } = GroupMessageSchema.parse(message.data);
  const senderId = connection.userId!;

  const { savedMessage, members } = await messageService.createGroupMessage(senderId, {
    conversationId,
    content,
    attachments,
  });

  for (const member of members) {
    if (member.userId === senderId) {
      continue;
    }

    const connections = connectionManager.getUserConnections(member.userId);

    for (const receiver of connections) {
      sendMessage(receiver, {
        type: WS_SERVER_EVENTS.NEW_MESSAGE,
        data: {
          senderId,
          messageId: savedMessage.id,
          conversationId,
          content: savedMessage.content,
          createdAt: savedMessage.createdAt,
          attachments: savedMessage.savedAttachments,
        },
      });
    }
  }

  sendMessage(connection, {
    type: WS_SERVER_EVENTS.MESSAGE_SENT,
    data: {
      senderId,
      messageId: savedMessage.id,
      conversationId,
      content: savedMessage.content,
      createdAt: savedMessage.createdAt,
      attachments: savedMessage.savedAttachments,
    },
  });
}
