import webPush from 'web-push';
import { env } from '@config/environment';
import { PushNotificationPayload } from '@dtos';

class WebPushService {
  constructor() {
    webPush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  }

  async send(subscription: webPush.PushSubscription, payload: PushNotificationPayload) {
    return webPush.sendNotification(subscription, JSON.stringify(payload));
  }
}

export const webPushService = new WebPushService();
