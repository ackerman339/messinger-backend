import { EntityManager, IsNull } from 'typeorm';
import { AppDataSource } from '@config/database';
import { ConversationRole } from '@appTypes';
import { ConversationMember } from '@entities';

export interface CreateConversationMemberParams {
  conversationId: string;
  userId: string;
  role: ConversationRole;
}

export const ConversationMemberRepository = AppDataSource.getRepository(ConversationMember).extend({
  async bulkCreate(members: CreateConversationMemberParams[], manager?: EntityManager) {
    const repository = manager ? manager.getRepository(ConversationMember) : this;

    if (members.length === 0) return;

    await repository.insert(
      members.map((member) => ({
        conversationId: member.conversationId,
        userId: member.userId,
        role: member.role,
      }))
    );
  },

  async findMember(conversationId: string, userId: string) {
    return this.findOne({
      where: {
        conversationId,
        userId,
      },
    });
  },

  async exists(conversationId: string, userId: string) {
    return this.existsBy({
      conversationId,
      userId,
      softDeletedAt: IsNull(),
    });
  },

  async getRemainingConversations(conversationId: string, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(ConversationMember) : this;

    return repository.count({
      where: {
        conversationId,
        softDeletedAt: IsNull(),
      },
    });
  },

  async getMembers(conversationId: string, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(ConversationMember) : this;

    return repository.find({
      where: {
        conversationId,
        softDeletedAt: IsNull(),
      },
    });
  },

  async updateRole(
    conversationId: string,
    userId: string,
    role: ConversationRole,
    manager?: EntityManager
  ) {
    const repository = manager ? manager.getRepository(ConversationMember) : this;

    await repository.update(
      {
        conversationId,
        userId,
      },
      {
        role,
      }
    );
  },

  async removeMember(conversationId: string, userId: string, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(ConversationMember) : this;

    const result = await repository.delete({
      conversationId,
      userId,
    });

    return result.affected ?? 0;
  },

  async markConversationAsDeleted(conversationId: string, userId: string, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(ConversationMember) : this;

    await repository.update(
      {
        conversationId,
        userId,
      },
      {
        softDeletedAt: new Date(),
      }
    );
  },

  async restoreConversation(conversationId: string, userId: string, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(ConversationMember) : this;

    await repository.update(
      {
        conversationId,
        userId,
      },
      {
        softDeletedAt: null,
        restoredAt: new Date(),
      }
    );
  },

  async incrementUnreadCount(conversationId: string, userId: string, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(ConversationMember) : this;

    await repository.increment(
      {
        conversationId,
        userId,
      },
      'unreadCount',
      1
    );
  },

  async resetUnreadCount(conversationId: string, userId: string, manager?: EntityManager) {
    const repository = manager ? manager.getRepository(ConversationMember) : this;

    await repository.update(
      {
        conversationId,
        userId,
      },
      {
        unreadCount: 0,
      }
    );
  },
});
