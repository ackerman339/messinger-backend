import { EntityManager, MoreThan } from 'typeorm';
import { AppDataSource } from '@config/database';
import { Message } from '@entities';

export const MessageRepository = AppDataSource.getRepository(Message).extend({
  async saveMessage(message: Message, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(Message) : this;

    return repository.save(message);
  },

  async findById(id: string) {
    return this.findOne({
      where: {
        id,
      },
      relations: {
        conversation: {
          members: true,
        },
        deliveries: true,
      },
    });
  },

  async findByConversation(conversationId: string, lastDeletedAt: Date | null) {
    return this.find({
      where: {
        conversationId,
        ...(lastDeletedAt && {
          createdAt: MoreThan(lastDeletedAt),
        }),
      },
      order: {
        createdAt: 'ASC',
      },
    });
  },
});
