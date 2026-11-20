import { MoreThan } from 'typeorm';
import { Connection, MessageStatus, GroupInvitationStatus } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { connectionManager } from '@websocket/managers/connection-manager';
import { sendMessage } from '@websocket/send-message';
import { messageService } from '@services';
import { GroupInvitationRepository, MessageDeliveryRepository } from '@repositories';

class OfflineSyncService {
  async syncPendingMessages(userId: string, connection: Connection) {
    const pendingDeliveries = await MessageDeliveryRepository.find({
      where: { userId, status: MessageStatus.SENT },
      order: { createdAt: 'ASC', id: 'ASC' },
      relations: { message: { attachments: true, conversation: { members: { user: true } } } },
    });
    for (const { message } of pendingDeliveries) {
      if (!message) continue;
      const member = message.conversation.members.find((item) => item.userId === userId);
      if (
        !member ||
        member.softDeletedAt ||
        (member.emptyMessagesAt && message.createdAt <= member.emptyMessagesAt)
      )
        continue;
      const content = messageService.decodeContent(message);
      sendMessage(connection, {
        type: WS_SERVER_EVENTS.NEW_MESSAGE,
        data: messageService.serializeMessage({ ...message, ...content }, message.conversation),
      });
    }
  }

  async syncPendingGroupInvitations(userId: string) {
    const invitations = await GroupInvitationRepository.find({
      where: {
        targetId: userId,
        status: GroupInvitationStatus.PENDING,
        expiresAt: MoreThan(new Date()),
      },
      relations: { conversation: true },
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
            groupName: invitation.conversation.name,
            invitedBy: invitation.actorId,
          },
        });
      }
    }
  }
}

export const offlineSyncService = new OfflineSyncService();
