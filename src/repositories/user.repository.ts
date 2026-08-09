import { FindOptionsWhere, LessThan } from 'typeorm';
import { AppDataSource } from '@config/database';
import { UserRole } from '@appTypes';
import { ListUsersDto } from '@dtos';
import { User } from '@entities';

export const UserRepository = AppDataSource.getRepository(User).extend({
  async findByLoginKeyLookup(loginKeyLookup: string) {
    return this.findOne({ where: { loginKeyLookup } });
  },

  async getAllUsers(role: UserRole, { cursor, limit }: ListUsersDto) {
    let cursorConversation;

    const where: FindOptionsWhere<User> = {
      role,
    };

    if (cursor) {
      cursorConversation = await this.findOne({
        where: {
          id: cursor,
        },
      });
    }

    if (cursorConversation) {
      where.createdAt = LessThan(cursorConversation.createdAt);
    }

    return this.find({
      where,
      select: {
        id: true,
        username: true,
        lastSeenAt: true,
        createdAt: true,
      },
      order: {
        createdAt: 'DESC',
      },
      take: limit + 1,
    });
  },
});
