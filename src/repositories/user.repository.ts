import { AppDataSource } from '@config/database';
import { User } from '@entities/user.entity';

export const UserRepository = AppDataSource.getRepository(User).extend({
  async findByLoginKeyLookup(loginKeyLookup: string) {
    return this.findOne({ where: { loginKeyLookup } });
  },
});
