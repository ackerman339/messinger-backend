import { AppDataSource } from '@config/database';
import { ConversationEvent } from '@entities';
import { EntityManager } from 'typeorm';

export const ConversationEventRepository = AppDataSource.getRepository(ConversationEvent).extend({
  async createEvent(event: Partial<ConversationEvent>, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(ConversationEvent) : this;

    return repository.save(repository.create(event));
  },
});
