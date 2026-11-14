import { z } from 'zod';

export const PushNotificationSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  icon: z.string().optional(),
  data: z.discriminatedUnion('type', [
    z.object({
      type: z.enum(['request-connection', 'message']),
      conversationId: z.uuid(),
      messageId: z.uuid().optional(),
    }),
    z.object({
      type: z.enum(['call-incoming', 'call-missed']),
      callId: z.uuid(),
      callerId: z.uuid(),
      callerName: z.string().trim().min(1).max(100).optional(),
      media: z.enum(['audio', 'video']).optional(),
      expiresAt: z.iso.datetime().nullable().optional(),
    }),
  ]),
});

export type PushNotificationPayload = z.infer<typeof PushNotificationSchema>;
