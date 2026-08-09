import { EntityManager, MoreThan, LessThan, Raw, FindOptionsWhere } from 'typeorm';
import { AppDataSource } from '@config/database';
import { Message } from '@entities';

type FindMessagesParams = {
  limit: number;
  conversationId: string;
  cursor?: string;
  lastDeletedAt?: Date | null;
};

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

  async findByConversation({ conversationId, limit, cursor, lastDeletedAt }: FindMessagesParams) {
    let createdAt;
    let cursorMessage;

    const where: FindOptionsWhere<Message> = {
      conversationId,
    };

    if (cursor) {
      cursorMessage = await this.findOne({
        where: {
          id: cursor,
          conversationId,
        },
        relations: { attachments: true },
        select: {
          id: true,
          createdAt: true,
          attachments: true,
        },
      });
    }

    if (lastDeletedAt && cursorMessage) {
      createdAt = Raw((column) => `${column} > :lastDeletedAt AND ${column} < :cursorCreatedAt`, {
        lastDeletedAt,
        cursorCreatedAt: cursorMessage.createdAt,
      });
    } else if (cursorMessage) {
      createdAt = LessThan(cursorMessage.createdAt);
    } else if (lastDeletedAt) {
      createdAt = MoreThan(lastDeletedAt);
    }

    if (createdAt) {
      where.createdAt = createdAt;
    }

    return this.find({
      where,
      relations: {
        attachments: true,
      },
      order: {
        createdAt: 'DESC',
      },
      take: limit + 1,
    });
  },
});
