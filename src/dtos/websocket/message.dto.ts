import { z } from 'zod';

export const MessageTypeSchema = z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE']);

const MessageContentSchema = z.object({
  content: z.string().min(1).max(5000),
});

export const PrivateMessageSchema = MessageContentSchema.extend({
  receiverId: z.uuid(),
});

export const GroupMessageSchema = MessageContentSchema.extend({
  conversationId: z.uuid(),
});

export type GroupMessageDto = z.infer<typeof GroupMessageSchema>;
export type PrivateMessageDto = z.infer<typeof PrivateMessageSchema>;
