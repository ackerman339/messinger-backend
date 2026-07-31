import { ConversationEventType } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { connectionManager } from '@websocket/managers/connection-manager';
import { sendMessage } from '@websocket/send-message';
import { groupEvents } from './group-events';

export function registerGroupListeners() {
  groupEvents.on(
    ConversationEventType.MEMBER_JOINED,
    async ({ conversationId, userId, members }) => {
      for (const member of members) {
        const connections = connectionManager.getUserConnections(member.userId);

        for (const connection of connections) {
          sendMessage(connection, {
            type: WS_SERVER_EVENTS.GROUP_MEMBER_JOINED,
            data: {
              conversationId,
              userId,
            },
          });
        }
      }
    }
  );

  groupEvents.on(ConversationEventType.MEMBER_LEFT, async ({ conversationId, userId, members }) => {
    for (const member of members) {
      const connections = connectionManager.getUserConnections(member.userId);

      for (const connection of connections) {
        sendMessage(connection, {
          type: WS_SERVER_EVENTS.GROUP_MEMBER_LEFT,
          data: {
            conversationId,
            userId,
          },
        });
      }
    }
  });

  groupEvents.on(
    ConversationEventType.MEMBER_REMOVED,
    async ({ conversationId, actorId, removedUserId, members }) => {
      const users = new Set<string>();

      users.add(removedUserId);

      for (const member of members) {
        users.add(member.userId);
      }

      for (const userId of users) {
        const connections = connectionManager.getUserConnections(userId);

        for (const connection of connections) {
          sendMessage(connection, {
            type: WS_SERVER_EVENTS.GROUP_MEMBER_REMOVED,
            data: {
              conversationId,
              actorId,
              removedUserId,
            },
          });
        }
      }
    }
  );

  groupEvents.on(
    ConversationEventType.OWNERSHIP_TRANSFERRED,
    async ({ conversationId, previousOwnerId, newOwnerId, members }) => {
      for (const member of members) {
        const connections = connectionManager.getUserConnections(member.userId);

        for (const connection of connections) {
          sendMessage(connection, {
            type: WS_SERVER_EVENTS.GROUP_OWNER_CHANGED,
            data: {
              conversationId,
              previousOwnerId,
              newOwnerId,
            },
          });
        }
      }
    }
  );

  groupEvents.on(ConversationEventType.GROUP_DELETED, ({ conversationId, members }) => {
    for (const userId of members) {
      const connections = connectionManager.getUserConnections(userId);

      for (const connection of connections) {
        sendMessage(connection, {
          type: WS_SERVER_EVENTS.GROUP_DELETED,
          data: {
            conversationId,
          },
        });
      }
    }
  });
}
