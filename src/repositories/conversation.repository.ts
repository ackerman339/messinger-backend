import { EntityManager } from 'typeorm';
import { AppDataSource } from '@config/database';
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
        members: true,
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

  async getConversationList(userId: string) {
    return this.createQueryBuilder('conversation')
      .innerJoin(
        'conversation.members',
        'currentMember',
        `
        currentMember.userId = :userId
        AND currentMember.softDeletedAt IS NULL
      `,
        { userId }
      )
      .leftJoinAndSelect('conversation.lastMessage', 'lastMessage')
      .leftJoinAndSelect('conversation.members', 'members')
      .leftJoinAndSelect('members.user', 'user')
      .orderBy('lastMessage.createdAt', 'DESC', 'NULLS LAST')
      .getMany();
  },
});
