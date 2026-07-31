import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { InviteGroupMemberDto, InviteGroupMemberSchema } from '@dtos';
import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';
import { conversationService } from '@services';

export async function inviteGroupMemberHandler({
  connection,
  message,
}: WsHandlers<InviteGroupMemberDto>) {
  requireAuthentication(connection);

  const { conversationId, targetUserId } = InviteGroupMemberSchema.parse(message.data);
  const actorId = connection.userId!;

  const conversation = await conversationService.validateGroupInvitation(actorId, {
    conversationId,
    targetUserId,
  });

  const invitedConnections = connectionManager.getUserConnections(targetUserId);

  for (const invitedConnection of invitedConnections) {
    sendMessage(invitedConnection, {
      type: WS_SERVER_EVENTS.GROUP_INVITATION,
      data: {
        conversationId: conversation.id,
        groupName: conversation.name,
        invitedBy: actorId,
      },
    });
  }
}
