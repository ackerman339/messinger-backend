import { WS_SERVER_EVENTS } from '@constants';
import { connectionManager } from '../managers/connection-manager';
import { sendMessage } from '../send-message';
import { WsHandlers } from '@appTypes';
import { GroupInvitationDto, GroupInvitationSchema } from '@dtos';
import { conversationService } from '@services';
import { requireAuthentication } from '../authenticate-guard';

export async function rejectGroupInvitationHandler({
  connection,
  message,
}: WsHandlers<GroupInvitationDto>) {
  requireAuthentication(connection);

  const { conversationId } = GroupInvitationSchema.parse(message.data);

  const userId = connection.userId!;

  await conversationService.rejectGroupInvitation(conversationId, userId);
  for (const receiver of connectionManager.getUserConnections(userId)) {
    sendMessage(receiver, {
      type: WS_SERVER_EVENTS.GROUP_INVITATION_REJECTED,
      data: { conversationId },
    });
  }
}
