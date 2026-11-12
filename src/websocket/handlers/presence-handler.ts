import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { UserPresenceOnlineSchema, UserPresenceOnlineDto } from '@dtos';
import { userService } from '@services';
import {
  UserRepository,
  ConversationMemberRepository,
  ConversationRepository,
} from '@repositories';

import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';

export async function presenceOnlineHandler({
  connection,
  message,
}: WsHandlers<UserPresenceOnlineDto>) {
  requireAuthentication(connection);

  const userId = connection.userId;

  if (!userId) {
    return;
  }

  const { receiverId } = UserPresenceOnlineSchema.parse(message.data);
  const receiverConnections = connectionManager.getUserConnections(receiverId);
  const user = await UserRepository.findOne({ where: { id: receiverId } });

  if (receiverConnections.length > 0) {
    sendMessage(connection, {
      type: WS_SERVER_EVENTS.PRESENCE_ONLINE,
      data: {
        online: true,
        lastSeenAt: null,
      },
    });
  } else {
    sendMessage(connection, {
      type: WS_SERVER_EVENTS.PRESENCE_ONLINE,
      data: {
        online: false,
        lastSeenAt: user?.lastSeenAt,
      },
    });
  }
}

type PresenceHandlerParams = {
  userId: string;
  isConnected?: boolean;
};

export async function presenceHandler({ userId, isConnected = false }: PresenceHandlerParams) {
  const conversationPromises = [];
  const [memberships] = await Promise.all([
    ConversationMemberRepository.find({
      where: { userId },
      select: { conversationId: true },
    }),
    ...(isConnected ? [] : [userService.updateLastSeenAt(userId)]),
  ]);

  for (const membership of memberships) {
    const promise = ConversationRepository.getConversationMembers(membership.conversationId);
    conversationPromises.push(promise);
  }

  const members = await Promise.all(conversationPromises);
  const receiversId: string[] = [];

  for (const member of members) {
    const receiver = member.find((member) => member.userId !== userId);
    if (!receiver) {
      continue;
    }

    receiversId.push(receiver.userId);
  }

  for (const id of receiversId) {
    const receiverConnections = connectionManager.getUserConnections(id);

    for (const connection of receiverConnections) {
      sendMessage(connection, {
        type: WS_SERVER_EVENTS.PRESENCE_OFFLINE,
        ...(isConnected
          ? {
              data: {
                online: true,
                lastSeenAt: null,
              },
            }
          : {
              data: {
                online: false,
                lastSeenAt: new Date(),
              },
            }),
      });
    }
  }
}
