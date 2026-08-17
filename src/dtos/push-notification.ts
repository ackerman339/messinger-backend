import { z } from 'zod';

export const PushNotificationSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  icon: z.string().optional(),
  data: z.object({
    conversationId: z.string().uuid(),
    messageId: z.string().uuid(),
  }),
});

export type PushNotificationPayload = z.infer<typeof PushNotificationSchema>;
