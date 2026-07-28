import { AppDataSource } from '@config/database';
import { createHash } from 'node:crypto';
import { ConversationType, ConversationRole } from '@appTypes';
import { ForbiddenException } from '@exceptions';
import { ConversationRepository, ConversationMemberRepository } from '@repositories';

type CreateConversationParams = {
  type: ConversationType;
  creatorId: string;
  members: string[];
};

type GetMemberRolParams = {
  type: ConversationType;
  userId: string;
  creatorId: string;
};

class ConversationService {
  private generatePrivateKey(userIds: string[]) {
    const value = userIds.sort().join(':');

    return createHash('sha256').update(value).digest('hex');
  }

  private getMemberRole({ type, userId, creatorId }: GetMemberRolParams) {
    if (type === ConversationType.GROUP && userId === creatorId) {
      return ConversationRole.OWNER;
    }

    return ConversationRole.MEMBER;
  }

  async getOrCreatePrivateConversation({ type, creatorId, members }: CreateConversationParams) {
    let privateKey: string | null = null;

    const uniqueMembers = [creatorId, ...members].filter(
      (id, index, array) => array.indexOf(id) === index
    );

    // Prevent duplicate private conversations.
    if (type === ConversationType.PRIVATE) {
      if (uniqueMembers.length > 2) {
        throw new ForbiddenException('CREATE_CONVERSATION:PRIVATE_CONVERSATION_REQUIRES_TWO_USERS');
      }

      privateKey = this.generatePrivateKey(uniqueMembers);
      const existing = await ConversationRepository.findByPrivateKey(privateKey);

      if (existing) {
        return existing;
      }
    }

    return AppDataSource.transaction(async (manager) => {
      const newConversation = ConversationRepository.create({
        type,
        privateKey,
      });

      const savedConversation = await ConversationRepository.saveConversation(
        newConversation,
        manager
      );

      const conversationMembers = uniqueMembers.map((userId) => ({
        userId,
        conversationId: savedConversation.id,
        role: this.getMemberRole({ type, userId, creatorId }),
      }));

      await ConversationMemberRepository.bulkCreate(conversationMembers, manager);

      return savedConversation;
    });
  }
}

export const conversationService = new ConversationService();
