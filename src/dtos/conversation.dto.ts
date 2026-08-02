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
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});

export const TypingSchema = z.object({
  conversationId: z.uuid(),
  isTyping: z.boolean().default(false),
});

export type CreateGroupDto = z.infer<typeof CreateGroupSchema>;
export type LeaveGroupDto = z.infer<typeof LeaveGroupSchema>;
export type TransferOwnershipDto = z.infer<typeof TransferOwnershipSchema>;
export type RemoveMemberDto = z.infer<typeof RemoveMemberSchema>;
export type DeleteConversationDto = z.infer<typeof DeleteConversationSchema>;
export type GetConversationMessagesDto = z.infer<typeof GetConversationMessagesSchema>;
export type TypingDto = z.infer<typeof TypingSchema>;
