import { z } from 'zod';

export const PushNotificationSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  icon: z.string().optional(),
  data: z.object({
    type: z.enum(['request-connection', 'message']),
    conversationId: z.uuid(),
    messageId: z.uuid().optional(),
  }),
});

export type PushNotificationPayload = z.infer<typeof PushNotificationSchema>;
