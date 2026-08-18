import { EntityManager } from 'typeorm';
import { AppDataSource } from '@config/database';
import { ListConversationsDto } from '@dtos';
import { Conversation } from '@entities';

export const ConversationRepository = AppDataSource.getRepository(Conversation).extend({
  async saveConversation(conversation: Conversation, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(Conversation) : this;
    return repository.save(conversation);
  },

  async findById(id: string) {
    return this.findOne({ where: { id }, relations: { members: true } });
  },

  async findByPrivateKey(privateKey: string) {
    return this.findOne({
      where: {
        privateKey,
      },
      relations: {
        members: {
          user: true,
        },
      },
    });
  },

  async getConversationMembers(id: string) {
    const conversation = await this.findOne({ where: { id }, relations: { members: true } });

    if (!conversation) {
      return [];
    }

    return conversation.members;
  },

  async deleteConversation(conversationId: string, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(Conversation) : this;

    await repository.delete({
      id: conversationId,
    });
  },

  async updateLastMessage(conversationId: string, messageId: string, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(Conversation) : this;

    await repository.update(
      { id: conversationId },
      {
        lastMessageId: messageId,
      }
    );
  },

  async getConversationList(userId: string, dto: Pick<ListConversationsDto, 'cursor' | 'limit'>) {
    let cursorConversation;
    const { cursor, limit } = dto;

    if (cursor) {
      cursorConversation = await this.findOne({
        where: {
          id: cursor,
        },
      });
    }

    const idsQuery = this.createQueryBuilder('conversation')
      .select(['conversation.id', 'conversation.updatedAt'])
      .innerJoin(
        'conversation.members',
        'currentMember',
        `
        currentMember.userId = :userId
        AND currentMember.softDeletedAt IS NULL
      `,
        { userId }
      )
      .orderBy('conversation.updatedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('conversation.id', 'DESC')
      .take(limit + 1);

    if (cursorConversation) {
      if (cursorConversation.updatedAt === null) {
        idsQuery.andWhere('conversation.updatedAt IS NULL').andWhere('conversation.id < :id', {
          id: cursorConversation.id,
        });
      } else {
        idsQuery.andWhere(
          `(
          conversation.updatedAt < :cursorUpdatedAt
          OR (conversation.updatedAt = :cursorUpdatedAt AND conversation.id < :cursorId)
          OR conversation.updatedAt IS NULL
        )`,
          { cursorUpdatedAt: cursorConversation.updatedAt, cursorId: cursorConversation.id }
        );
      }
    }

    const conversationIds = await idsQuery.getMany();

    if (conversationIds.length === 0) {
      return [];
    }

    const conversations = await this.createQueryBuilder('conversation')
      .select([
        'conversation.id',
        'conversation.name',
        'conversation.type',
        'conversation.createdAt',
        'conversation.updatedAt',
      ])
      .leftJoin('conversation.members', 'members')
      .addSelect(['members.conversationId', 'members.unreadCount'])
      .leftJoin('members.user', 'user')
      .addSelect(['user.id', 'user.username', 'user.lastSeenAt'])
      .whereInIds(conversationIds)
      .getMany();

    const rowsById = new Map(conversations.map((row) => [row.id, row]));
    const orderedRows = conversationIds.map((conversation) => rowsById.get(conversation.id)!);

    return orderedRows;
  },
});
