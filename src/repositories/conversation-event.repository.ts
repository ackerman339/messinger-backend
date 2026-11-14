import { EntityManager, LessThan, FindOptionsWhere } from 'typeorm';
import { AppDataSource } from '@config/database';
import { ConversationEvent, Message } from '@entities';

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
    let cursorEvent: Pick<ConversationEvent, 'id' | 'createdAt'> | null = null;

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

    // The shared history cursor can belong to a message or a conversation event.
    if (cursor && !cursorEvent) {
      cursorEvent = await AppDataSource.getRepository(Message).findOne({
        where: { id: cursor, conversationId },
        select: { id: true, createdAt: true },
      });
    }

    if (cursorEvent) {
      where.createdAt = LessThan(cursorEvent?.createdAt);
    }

    return this.find({
      where,
      order: {
        createdAt: 'DESC',
      },
      take: limit + 1,
    });
  },
});
