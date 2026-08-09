import bcrypt from 'bcrypt';
import { env } from '@config/environment';
import { UserRole } from '@appTypes';
import { UserDto, ListUserMessagesDto, ListUsersDto, ListConversationsDto } from '@dtos';
import { LOGIN_KEY_LENGTH } from '@constants';
import { User, Conversation } from '@entities';
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
    await UserRepository.delete({ id: dto.userId });
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
