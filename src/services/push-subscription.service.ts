import { AppDataSource } from '@config/database';
import { MobilePushSubscriptionDto, WebPushSubscriptionDto } from '@dtos';
import { PushSubscriptionRepository } from '@repositories';

class PushSubscriptionService {
  async subscribeWeb(userId: string, dto: WebPushSubscriptionDto) {
    await AppDataSource.transaction('SERIALIZABLE', async (manager) => {
      const subscription = await PushSubscriptionRepository.findByEndpoint(dto.endpoint, manager);

      if (subscription) {
        await PushSubscriptionRepository.updateSubscription(subscription, dto, manager);
        return;
      }

      await PushSubscriptionRepository.createSubscription(userId, dto, manager);
    });
  }

  async unsubscribeWeb(endpoint: string) {
    await PushSubscriptionRepository.deleteByEndpoint(endpoint);
  }

  async findByUserId(userId: string) {
    return PushSubscriptionRepository.findByUserId(userId);
  }

  async removeInvalidSubscription(endpoint: string) {
    await PushSubscriptionRepository.deleteByEndpoint(endpoint);
  }

  async subscribeMobile(userId: string, dto: MobilePushSubscriptionDto) {
    await PushSubscriptionRepository.subscribeMobile(userId, dto);
  }

  async unsubscribeMobile(userId: string, token: string) {
    await PushSubscriptionRepository.deleteMobile(userId, token);
  }

  async removeInvalidMobileSubscription(id: string, token: string) {
    await PushSubscriptionRepository.removeInvalidMobile(id, token);
  }
}

export const pushSubscriptionService = new PushSubscriptionService();
