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
}
