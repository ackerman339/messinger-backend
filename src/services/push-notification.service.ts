import webPush from 'web-push';
import { PushNotificationPayload } from '@dtos';
import { pushSubscriptionService } from './push-subscription.service';
import { webPushService } from './web-push.service';

class PushNotificationService {
  async sendToUser(
    userId: string,
    payload: PushNotificationPayload,
    options?: webPush.RequestOptions
  ) {
    const subscriptions = await pushSubscriptionService.findByUserId(userId);

    try {
      await Promise.all(
        subscriptions.map(async (subscription) => {
          const webSubscription: webPush.PushSubscription = {
            endpoint: subscription.endpoint!,
            keys: {
              p256dh: subscription.p256dh!,
              auth: subscription.auth!,
            },
          };

          return webPushService.send(webSubscription, payload, options);
        })
      );
    } catch (error) {
      if (
        error instanceof webPush.WebPushError &&
        (error.statusCode === 404 || error.statusCode === 410)
      ) {
        await Promise.all(
          subscriptions.map((subscription) => {
            return pushSubscriptionService.removeInvalidSubscription(subscription.endpoint!);
          })
        );
      }
    }
  }
}

export const pushNotificationService = new PushNotificationService();
