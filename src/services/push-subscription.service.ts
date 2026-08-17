import { AppDataSource } from '@config/database';
import { WebPushSubscriptionDto } from '@dtos';
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
}

export const pushSubscriptionService = new PushSubscriptionService();
