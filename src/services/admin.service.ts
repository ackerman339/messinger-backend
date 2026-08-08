import bcrypt from 'bcrypt';
import { env } from '@config/environment';
import { UserRole } from '@appTypes';
import { UserDto, ListUserMessagesDto } from '@dtos';
import { LOGIN_KEY_LENGTH } from '@constants';
import { generateRandomString, generateLoginKeyLookup } from '@utils';
import { Conversation } from '@entities';
import { messageService } from '@services';
import {
  UserRepository,
  ConversationMemberRepository,
  ConversationRepository,
} from '@repositories';

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

  async listUsers() {
    return UserRepository.find({
      where: { role: UserRole.USER },
      select: { username: true, id: true, createdAt: true, lastSeenAt: true },
      order: { createdAt: 'DESC' },
    });
  }

  async listAdmins() {
    return UserRepository.find({
      where: { role: UserRole.ADMIN },
      select: { adminName: true, id: true, createdAt: true },
      order: { createdAt: 'DESC' },
    });
  }

  async listUserConversations(dto: UserDto) {
    const conversationsPromises: Promise<Conversation | null>[] = [];
    const conversationsMember = await ConversationMemberRepository.find({
      where: { userId: dto.userId },
    });

    for (const conversation of conversationsMember) {
      conversationsPromises.push(
        ConversationRepository.findOne({ where: { id: conversation.conversationId } })
      );
    }

    return Promise.all(conversationsPromises);
  }

  async listConversationMessages(dto: ListUserMessagesDto) {
    return messageService.getConversationMessages(dto.userId, { ...dto });
  }
}

export const adminService = new AdminService();
