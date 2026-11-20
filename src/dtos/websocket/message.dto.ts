import { z } from 'zod';
import { LocationInputSchema } from './location.dto';

export const MessageAttachmentSchema = z.object({
  id: z.uuid(),
  storageKey: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  size: z.number().int().positive(),
});

const MessageContentSchema = z.object({
  clientMessageId: z.uuid().optional(),
  content: z.string().min(1).max(5000),
  attachments: z.array(MessageAttachmentSchema).max(10).default([]),
  location: LocationInputSchema.optional(),
});

export const PrivateMessageSchema = MessageContentSchema.extend({
  receiverId: z.uuid(),
}).refine(({ location, attachments }) => !location || attachments.length === 0);

export const GroupMessageSchema = MessageContentSchema.extend({
  conversationId: z.uuid(),
}).refine(({ location, attachments }) => !location || attachments.length === 0);

export type GroupMessageDto = z.infer<typeof GroupMessageSchema>;
export type PrivateMessageDto = z.infer<typeof PrivateMessageSchema>;
export type MessageAttachmentDto = z.infer<typeof MessageAttachmentSchema>;
