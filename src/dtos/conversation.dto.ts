import { z } from 'zod';

export const CreateGroupSchema = z.object({
  name: z.string().min(1).max(100),
  members: z.array(z.uuid()),
});

export const LeaveGroupSchema = z.object({
  conversationId: z.uuid(),
});

export const TransferOwnershipSchema = z.object({
  conversationId: z.uuid(),
  newOwnerId: z.uuid(),
});

export const RemoveMemberSchema = z.object({
  conversationId: z.uuid(),
  targetUserId: z.uuid(),
});

export const DeleteConversationSchema = z.object({
  conversationId: z.uuid(),
});

export const GetConversationMessagesSchema = z.object({
  conversationId: z.uuid(),
});

export type CreateGroupDto = z.infer<typeof CreateGroupSchema>;
export type LeaveGroupDto = z.infer<typeof LeaveGroupSchema>;
export type TransferOwnershipDto = z.infer<typeof TransferOwnershipSchema>;
export type RemoveMemberDto = z.infer<typeof RemoveMemberSchema>;
export type DeleteConversationDto = z.infer<typeof DeleteConversationSchema>;
export type GetConversationMessagesDto = z.infer<typeof GetConversationMessagesSchema>;
