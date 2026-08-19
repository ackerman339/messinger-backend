import bcrypt from 'bcrypt';
import { AppDataSource } from '@config/database';
import { env } from '@config/environment';
import { UserRole } from '@appTypes';
import { UserDto, ListUserMessagesDto, ListUsersDto, ListConversationsDto } from '@dtos';
import { LOGIN_KEY_LENGTH } from '@constants';
import { User, Conversation, ConversationMember } from '@entities';
import { generateRandomString, generateLoginKeyLookup, paginate } from '@utils';
import { messageService } from '@services';
import { UserRepository, ConversationRepository } from '@repositories';

class AdminService {
  private async hashLoginKey(key: string) {
    return await bcrypt.hash(key, env.SALT_ROUNDS);
  }

  async restoreUserLoginKey(dto: UserDto) {
    const { userId } = dto;
    const loginKey = generateRandomString(LOGIN_KEY_LENGTH);
    const loginKeyHash = await this.hashLoginKey(loginKey);
    const loginKeyLookup = generateLoginKeyLookup(loginKey);

    await UserRepository.update({ id: userId }, { loginKeyHash, loginKeyLookup });

    return { loginKey };
  }

  async deleteUser(dto: UserDto) {
    await AppDataSource.transaction(async (manager) => {
      const memberships = await manager.find(ConversationMember, {
        where: {
          userId: dto.userId,
        },
      });

      const conversationIds = memberships.map((membership) => membership.conversationId);

      await manager.delete(User, {
        id: dto.userId,
      });

      if (conversationIds.length > 0) {
        await manager
          .createQueryBuilder()
          .delete()
          .from(Conversation)
          .where('id IN (:...conversationIds)', {
            conversationIds,
          })
          .andWhere(
            `
          NOT EXISTS (
            SELECT 1
            FROM conversation_members cm
            WHERE cm.conversation_id = conversations.id
          )
        `
          )
          .execute();
      }
    });
  }

  async deleteAdmin(dto: UserDto) {
    await UserRepository.delete({ id: dto.userId, role: UserRole.ADMIN });
  }

  async listUsers({ cursor, limit }: ListUsersDto) {
    const users = await UserRepository.getAllUsers(UserRole.USER, { cursor, limit });
    const { page, nextCursor } = paginate<User>({ items: users, limit });

    return {
      page,
      nextCursor,
    };
  }

  async listAdmins({ cursor, limit }: ListUsersDto) {
    const users = await UserRepository.getAllUsers(UserRole.ADMIN, { cursor, limit });
    const { page, nextCursor } = paginate<User>({ items: users, limit });

    return {
      page,
      nextCursor,
    };
  }

  async listUserConversations({ userId, cursor, limit }: ListConversationsDto) {
    const conversations = await ConversationRepository.getConversationList(userId!, {
      cursor,
      limit,
    });
    const { page, nextCursor } = paginate<Conversation>({ items: conversations, limit });

    return { page, nextCursor };
  }

  async listConversationMessages(dto: ListUserMessagesDto) {
    return messageService.getConversationMessages(dto.userId, { ...dto });
  }
}

export const adminService = new AdminService();
