import { In } from 'typeorm';
import { AppDataSource } from '@config/database';
import { UserRole } from '@appTypes';
import { UserDto, ListUserMessagesDto, ListUsersDto, ListConversationsDto, AdminDto } from '@dtos';
import { LOGIN_KEY_LENGTH } from '@constants';
import { User, Conversation, ConversationMember, Message } from '@entities';
import { generateRandomString, generateLoginKeyLookup, paginate } from '@utils';
import { messageService, storageService, authService } from '@services';
import { UserRepository, ConversationRepository } from '@repositories';

class AdminService {
  async restoreUserLoginKey(dto: UserDto) {
    const { userId } = dto;
    const loginKey = generateRandomString(LOGIN_KEY_LENGTH);
    const loginKeyHash = await authService.hashLoginKeyOrPassword(loginKey);
    const loginKeyLookup = generateLoginKeyLookup(loginKey);

    await UserRepository.update({ id: userId }, { loginKeyHash, loginKeyLookup });

    return { loginKey };
  }

  async deleteUser(dto: UserDto) {
    await AppDataSource.transaction(async (manager) => {
      // 1. Get the conversations where the user is a member.
      const memberships = await manager.find(ConversationMember, {
        where: {
          userId: dto.userId,
        },
      });

      const conversationIds = memberships.map((membership) => membership.conversationId);

      if (conversationIds.length > 0) {
        // 2. Find conversations that will have no members after deleting this user.
        const conversationsToDelete = await manager
          .createQueryBuilder(Conversation, 'conversation')
          .select('conversation.id', 'id')
          .where('conversation.id IN (:...conversationIds)', {
            conversationIds,
          })
          .andWhere(
            `
          NOT EXISTS (
            SELECT 1
            FROM conversation_members cm
            WHERE cm.conversation_id = conversation.id
              AND cm.user_id != :userId
          )
        `
          )
          .setParameter('userId', dto.userId)
          .getRawMany<{ id: string }>();

        const conversationIdsToDelete = conversationsToDelete.map(
          (conversation) => conversation.id
        );

        // 3. Delete R2 files belonging to messages from conversations that will actually be deleted.
        if (conversationIdsToDelete.length > 0) {
          const messages = await manager.find(Message, {
            where: {
              conversationId: In(conversationIdsToDelete),
            },
            relations: {
              attachments: true,
            },
            select: {
              attachments: {
                id: true,
                storageKey: true,
              },
            },
          });

          const storageKeys = messages.flatMap((message) =>
            message.attachments.map((attachment) => attachment.storageKey)
          );

          if (storageKeys.length > 0) {
            await storageService.deleteFiles(storageKeys);
          }

          // 4. Delete the conversations.
          // Conversation -> Message = CASCADE
          // Message -> MessageAttachment = CASCADE
          await manager
            .createQueryBuilder()
            .delete()
            .from(Conversation)
            .where('id IN (:...conversationIds)', {
              conversationIds: conversationIdsToDelete,
            })
            .execute();
        }
      }

      // 5. Delete the user.
      // conversation_members -> CASCADE
      // pending uploads -> CASCADE
      // messages.sender_id -> SET NULL
      await manager.delete(User, {
        id: dto.userId,
      });
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

  async updateAdminPassword(userId: string, dto: Pick<AdminDto, 'password'>) {
    const passwordHash = await authService.hashLoginKeyOrPassword(dto.password);
    return UserRepository.update({ id: userId }, { passwordHash });
  }
}

export const adminService = new AdminService();
