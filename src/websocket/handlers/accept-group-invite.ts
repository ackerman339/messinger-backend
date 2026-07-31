import { WsHandlers } from '@appTypes';
import { WS_SERVER_EVENTS } from '@constants';
import { conversationService } from '@services';
import { GroupInvitationDto, GroupInvitationSchema } from '@dtos';
import { requireAuthentication } from '../authenticate-guard';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';

export async function acceptGroupInvitationHandler({
  connection,
  message,
}: WsHandlers<GroupInvitationDto>) {
  requireAuthentication(connection);

  const { conversationId } = GroupInvitationSchema.parse(message.data);
  const userId = connection.userId!;

  const { members } = await conversationService.acceptGroupInvitation(conversationId, userId);

  for (const member of members) {
    const connections = connectionManager.getUserConnections(member.userId);

    for (const receiver of connections) {
      sendMessage(receiver, {
        type: WS_SERVER_EVENTS.GROUP_MEMBER_JOINED,
        data: {
          conversationId,
          userId,
        },
      });
    }
  }
}
