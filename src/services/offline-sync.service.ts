import { In, MoreThan } from 'typeorm';
import { MessageStatus, GroupInvitationStatus } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { connectionManager } from '@websocket/managers/connection-manager';
import { sendMessage } from '@websocket/send-message';
import { messageService } from '@services';
import {
  GroupInvitationRepository,
  MessageDeliveryRepository,
  MessageRepository,
} from '@repositories';

class OfflineSyncService {
  async syncPendingMessages(userId: string) {
    const pendingDeliveries = await MessageDeliveryRepository.find({
      where: {
        userId,
        status: MessageStatus.SENT,
      },
      order: { createdAt: 'DESC' },
    });

    if (pendingDeliveries.length === 0) {
      return;
    }

    const messageIds = pendingDeliveries.map((delivery) => delivery.messageId);
    const messages = (
      await MessageRepository.find({
        where: { id: In(messageIds) },
        order: { createdAt: 'DESC' },
      })
    ).map((message) => {
      const { cipheredContent, iv, authTag, ...rest } = message;
      const content = messageService.decipherMessage(cipheredContent, iv, authTag);
      return {
        ...rest,
        content,
      };
    });

    const messagesMap = new Map(messages.map((message) => [message.id, message]));
    const connections = connectionManager.getUserConnections(userId);

    if (connections.length === 0) {
      return;
    }

    for (const delivery of pendingDeliveries) {
      const message = messagesMap.get(delivery.messageId);

      if (!message) {
        continue;
      }

      for (const connection of connections) {
        sendMessage(connection, {
          type: WS_SERVER_EVENTS.NEW_MESSAGE,
          data: message,
        });
      }
    }

    await MessageDeliveryRepository.update(
      {
        userId,
        messageId: In(messageIds),
      },
      { status: MessageStatus.DELIVERED }
    );
  }

  async syncPendingGroupInvitations(userId: string) {
    const invitations = await GroupInvitationRepository.find({
      where: {
        targetId: userId,
        status: GroupInvitationStatus.PENDING,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (invitations.length === 0) {
      return;
    }

    const connections = connectionManager.getUserConnections(userId);

    if (connections.length === 0) {
      return;
    }

    for (const invitation of invitations) {
      for (const connection of connections) {
        sendMessage(connection, {
          type: WS_SERVER_EVENTS.GROUP_INVITATION,
          data: {
            invitationId: invitation.id,
            conversationId: invitation.conversationId,
          },
        });
      }
    }
  }
}

export const offlineSyncService = new OfflineSyncService();
