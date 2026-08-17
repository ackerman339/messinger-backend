import { z } from 'zod';

export const WebPushSubscriptionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const WebPushUnsubscriptionSchema = z.object({
  endpoint: z.url(),
});

export type WebPushSubscriptionDto = z.infer<typeof WebPushSubscriptionSchema>;
export type WebPushUnsubscriptionDto = z.infer<typeof WebPushUnsubscriptionSchema>;
