import { z } from 'zod';

const JWT_REGEX = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export const authenticateWsSchema = z.object({
  accessToken: z.string().trim().regex(JWT_REGEX, 'Invalid access token format'),
});

export const MessageTypeSchema = z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE']);

export const SendMessageWsSchema = z.object({
  type: MessageTypeSchema,
  receiverId: z.uuid(),
  attachmentId: z.uuid().optional(),
  content: z.string().optional(),
});

export type AuthenticateWsDto = z.infer<typeof authenticateWsSchema>;
export type SendMessageWsDto = z.infer<typeof SendMessageWsSchema>;
