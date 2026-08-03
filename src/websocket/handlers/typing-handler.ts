import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { TypingDto, TypingSchema } from '@dtos';
import { ConversationMemberRepository } from '@repositories';
import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';

export async function typingStartHandler({ connection, message }: WsHandlers<TypingDto>) {
  requireAuthentication(connection);

  const userId = connection.userId;

  if (!userId) {
    return;
  }

  const { conversationId, isTyping } = TypingSchema.parse(message.data);

  const [member, members] = await Promise.all([
    ConversationMemberRepository.findMember(conversationId, userId),
    ConversationMemberRepository.getMembers(conversationId),
  ]);

  if (!member || member.softDeletedAt) {
    return;
  }

  for (const member of members) {
    if (member.userId === userId) {
      continue;
    }

    const connections = connectionManager.getUserConnections(member.userId);

    for (const receiver of connections) {
      sendMessage(receiver, {
        type: isTyping ? WS_SERVER_EVENTS.TYPING_STARTED : WS_SERVER_EVENTS.TYPING_STOPPED,
        data: {
          userId,
        },
      });
    }
  }
}
