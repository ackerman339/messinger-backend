import { z } from 'zod';

export const GroupInvitationSchema = z.object({
  conversationId: z.uuid(),
});

export type GroupInvitationDto = z.infer<typeof GroupInvitationSchema>;
