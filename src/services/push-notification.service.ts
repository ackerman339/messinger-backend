import webPush from 'web-push';
import { PushNotificationPayload } from '@dtos';
import { pushSubscriptionService } from './push-subscription.service';
import { webPushService } from './web-push.service';

class PushNotificationService {
  async sendToUser(userId: string, payload: PushNotificationPayload) {
    const subscriptions = await pushSubscriptionService.findByUserId(userId);

    await Promise.all(
      subscriptions.map(async (subscription) => {
        const webSubscription: webPush.PushSubscription = {
          endpoint: subscription.endpoint!,
          keys: {
            p256dh: subscription.p256dh!,
            auth: subscription.auth!,
          },
        };

        try {
          await webPushService.send(webSubscription, payload);
        } catch (error) {
          if (
            error instanceof webPush.WebPushError &&
            (error.statusCode === 404 || error.statusCode === 410)
          ) {
            await pushSubscriptionService.removeInvalidSubscription(subscription.endpoint!);

            return;
          }

          throw error;
        }
      })
    );
  }
}

export const pushNotificationService = new PushNotificationService();
