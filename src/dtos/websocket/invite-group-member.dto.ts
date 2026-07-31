import { z } from 'zod';

export const InviteGroupMemberSchema = z.object({
  conversationId: z.uuid(),
  targetUserId: z.uuid(),
});

export type InviteGroupMemberDto = z.infer<typeof InviteGroupMemberSchema>;
