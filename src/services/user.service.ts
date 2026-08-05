import { NotFoundException } from '@exceptions';
import { UserRepository } from '@repositories';

class UserService {
  async getMe(userId: string) {
    const user = await UserRepository.findOne({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        userCode: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateLastSeenAt(userId: string) {
    const now = new Date();
    await UserRepository.update({ id: userId }, { lastSeenAt: now });

    return now;
  }

  async findUserByCode(userCode: string) {
    return UserRepository.findOne({
      where: { userCode },
      select: { username: true, id: true },
    });
  }
}

export const userService = new UserService();
