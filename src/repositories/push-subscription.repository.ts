import { EntityManager } from 'typeorm';
import { AppDataSource } from '@config/database';
import { PushPlatform, PushProvider } from '@appTypes';
import { MobilePushSubscriptionDto, WebPushSubscriptionDto } from '@dtos';
import { PushSubscription } from '@entities';

export const PushSubscriptionRepository = AppDataSource.getRepository(PushSubscription).extend({
  async createSubscription(userId: string, dto: WebPushSubscriptionDto, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(PushSubscription) : this;

    const subscription = repository.create({
      userId,
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      platform: PushPlatform.WEB,
      provider: PushProvider.WEB_PUSH,
    });

    return repository.save(subscription);
  },

  async subscribeMobile(userId: string, dto: MobilePushSubscriptionDto) {
    await AppDataSource.transaction('SERIALIZABLE', async (manager) => {
      const repository = manager.getRepository(PushSubscription);
      const existing = await repository.findOne({
        where: { provider: PushProvider.EXPO, token: dto.token },
      });

      // Reuse the registration when this device signs in with another account.
      const subscription = repository.create({
        ...existing,
        userId,
        token: dto.token,
        platform: dto.platform,
        provider: PushProvider.EXPO,
        endpoint: null,
        p256dh: null,
        auth: null,
      });

      await repository.save(subscription);
    });
  },

  async deleteMobile(userId: string, token: string) {
    await this.delete({ userId, token, provider: PushProvider.EXPO });
  },

  async removeInvalidMobile(id: string, token: string) {
    await this.delete({ id, token, provider: PushProvider.EXPO });
  },

  async findByEndpoint(endpoint: string, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(PushSubscription) : this;

    return repository.findOne({
      where: {
        endpoint,
      },
    });
  },

  async updateSubscription(
    subscription: PushSubscription,
    dto: WebPushSubscriptionDto,
    manager?: EntityManager
  ) {
    const repository = manager ? manager.getRepository(PushSubscription) : this;
    subscription.p256dh = dto.keys.p256dh;
    subscription.auth = dto.keys.auth;

    return repository.save(subscription);
  },

  async findByUserId(userId: string, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(PushSubscription) : this;

    return repository.find({
      where: {
        userId,
      },
    });
  },

  async deleteByEndpoint(endpoint: string, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(PushSubscription) : this;

    await repository.delete({
      endpoint,
    });
  },
});
