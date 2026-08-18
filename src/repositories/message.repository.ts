import { EntityManager, MoreThan, LessThan, Raw, FindOptionsWhere, In } from 'typeorm';
import { AppDataSource } from '@config/database';
import { DeleteMessagesDto } from '@dtos';
import { Message, Conversation } from '@entities';

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

  async findMessagesToCleanup(cutoff: Date) {
    return this.find({
      where: { createdAt: LessThan(cutoff) },
      relations: { attachments: true },
      select: {
        id: true,
        attachments: { id: true, storageKey: true },
      },
    });
  },

  async nullifyLastMessageReferences(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    await this.manager
      .getRepository(Conversation)
      .update({ lastMessageId: In(ids) }, { lastMessageId: null });
  },

  async deleteMessagesOlderThan(cutoff: Date): Promise<number> {
    const result = await this.delete({ createdAt: LessThan(cutoff) });
    return result.affected ?? 0;
  },

  async deleteMessages({ conversationId, messagesIds }: DeleteMessagesDto) {
    if (messagesIds.length === 0) {
      return;
    }

    const messages = await this.find({
      where: {
        conversationId,
        id: In(messagesIds),
      },
      relations: { attachments: true },
      select: {
        id: true,
        attachments: { id: true, storageKey: true },
      },
    });

    await this.nullifyLastMessageReferences(messagesIds);

    await this.delete({
      conversationId,
      id: In(messagesIds),
    });

    return messages;
  },
});
