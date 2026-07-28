import { z } from 'zod';

export const MessageTypeSchema = z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE']);

export const PrivateMessageSchema = z.object({
  receiverId: z.uuid(),
  content: z.string().min(1).max(5000),
});

export type PrivateMessageDto = z.infer<typeof PrivateMessageSchema>;
