import webPush from 'web-push';
import { PushProvider } from '@appTypes';
import { logger } from '@config/logger';
import { PushNotificationPayload } from '@dtos';
import { pushSubscriptionService } from './push-subscription.service';
import { webPushService } from './web-push.service';
import { mobilePushService, MobilePushError } from './mobile-push.service';

class PushNotificationService {
  async sendToUser(
    userId: string,
    payload: PushNotificationPayload,
    options?: webPush.RequestOptions
  ) {
    // Callers use fire-and-forget: capture lookup, transport and cleanup errors here.
    try {
      const subscriptions = await pushSubscriptionService.findByUserId(userId);

      const promises = subscriptions.map((subscription) => {
        let notification: Promise<unknown>;
        if (subscription.provider === PushProvider.EXPO && subscription.token) {
          notification = mobilePushService.send(subscription.token, payload, {
            ttl: options?.TTL,
            priority:
              options?.urgency === 'low' || options?.urgency === 'very-low' ? 'normal' : 'high',
          });
        } else if (
          subscription.provider === PushProvider.WEB_PUSH &&
          subscription.endpoint &&
          subscription.p256dh &&
          subscription.auth
        ) {
          notification = webPushService.send(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            payload,
            options
          );
        } else {
          return Promise.resolve();
        }

        return notification.catch(async (error: unknown) => {
          if (
            subscription.provider === PushProvider.EXPO &&
            subscription.token &&
            error instanceof MobilePushError &&
            error.code === 'DeviceNotRegistered'
          ) {
            await pushSubscriptionService.removeInvalidMobileSubscription(
              subscription.id,
              subscription.token
            );
          } else if (
            subscription.provider === PushProvider.WEB_PUSH &&
            subscription.endpoint &&
            error instanceof webPush.WebPushError &&
            (error.statusCode === 404 || error.statusCode === 410)
          ) {
            await pushSubscriptionService.removeInvalidSubscription(subscription.endpoint);
          }
          // Never log provider errors verbatim: they may contain tokens or payloads.
          logger.warn('[push] Notification failed', {
            subscriptionId: subscription.id,
            provider: subscription.provider,
            code: error instanceof MobilePushError ? error.code : undefined,
          });
        });
      });

      await Promise.all(promises);
    } catch {
      logger.error('[push] Failed to send notifications', { userId });
    }
  }
}

export const pushNotificationService = new PushNotificationService();
