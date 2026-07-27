import { z } from 'zod';

export const MessageTypeSchema = z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE']);

export const SendMessageWsSchema = z.object({
  type: MessageTypeSchema,
  receiverId: z.uuid(),
  attachmentId: z.uuid().optional(),
  content: z.string().optional(),
});

export type SendMessageWsDto = z.infer<typeof SendMessageWsSchema>;
