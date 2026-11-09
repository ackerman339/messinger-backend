import { z } from 'zod';
import { PushPlatform } from '@appTypes';

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

const ExpoPushTokenSchema = z
  .string()
  .max(255)
  .regex(/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/, 'Invalid Expo push token');

export const MobilePushSubscriptionSchema = z.object({
  token: ExpoPushTokenSchema,
  platform: z.enum([PushPlatform.ANDROID, PushPlatform.IOS]),
});

export const MobilePushUnsubscriptionSchema = z.object({
  token: ExpoPushTokenSchema,
});

export type MobilePushSubscriptionDto = z.infer<typeof MobilePushSubscriptionSchema>;
export type MobilePushUnsubscriptionDto = z.infer<typeof MobilePushUnsubscriptionSchema>;
