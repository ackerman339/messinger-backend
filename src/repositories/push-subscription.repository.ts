import { EntityManager } from 'typeorm';
import { AppDataSource } from '@config/database';
import { PushPlatform, PushProvider } from '@appTypes';
import { WebPushSubscriptionDto } from '@dtos';
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
