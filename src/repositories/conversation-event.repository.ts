import { EntityManager, LessThan, FindOptionsWhere } from 'typeorm';
import { AppDataSource } from '@config/database';
import { ConversationEvent } from '@entities';

type FindMessagesParams = {
  limit: number;
  conversationId: string;
  cursor?: string;
};

export const ConversationEventRepository = AppDataSource.getRepository(ConversationEvent).extend({
  async createEvent(event: Partial<ConversationEvent>, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(ConversationEvent) : this;

    return repository.save(repository.create(event));
  },

  async findByConversation({ conversationId, limit, cursor }: FindMessagesParams) {
    let cursorEvent;

    const where: FindOptionsWhere<ConversationEvent> = {
      conversationId,
    };

    if (cursor) {
      cursorEvent = await this.findOne({
        where: {
          id: cursor,
          conversationId,
        },
        select: {
          id: true,
          createdAt: true,
        },
      });
    }

    if (cursorEvent) {
      where.createdAt = LessThan(cursorEvent?.createdAt);
    }

    return this.find({
      where,
      order: {
        createdAt: 'ASC',
      },
      take: limit + 1,
    });
  },
});
