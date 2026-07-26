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
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}

export const userService = new UserService();
