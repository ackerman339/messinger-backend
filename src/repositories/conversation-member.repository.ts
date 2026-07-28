import { EntityManager } from 'typeorm';
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
});
