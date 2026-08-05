import { z } from 'zod';

export const MessageAttachmentSchema = z.object({
  id: z.uuid(),
  storageKey: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  size: z.number().int().positive(),
});

const MessageContentSchema = z.object({
  content: z.string().min(1).max(5000),
  attachments: z.array(MessageAttachmentSchema).max(10).default([]),
});

export const PrivateMessageSchema = MessageContentSchema.extend({
  receiverId: z.uuid(),
});

export const GroupMessageSchema = MessageContentSchema.extend({
  conversationId: z.uuid(),
});

export type GroupMessageDto = z.infer<typeof GroupMessageSchema>;
export type PrivateMessageDto = z.infer<typeof PrivateMessageSchema>;
export type MessageAttachmentDto = z.infer<typeof MessageAttachmentSchema>;
