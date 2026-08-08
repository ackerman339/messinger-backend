import bcrypt from 'bcrypt';
import { AppDataSource } from '../data-source';
import { env } from '@config/environment';
import { logger } from '@config/logger';
import { User } from '@entities';
import { UserRole } from '@appTypes';

export const adminSeed = async (dataSource: typeof AppDataSource) => {
  const UserRepository = dataSource.getRepository(User);

  const existingAdmin = await UserRepository.findOne({
    where: { role: UserRole.ADMIN, adminName: env.ADMIN_NAME },
  });

  if (existingAdmin) {
    logger.warn('Admin user already seeded, skipping...');
    return;
  }

  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, env.SALT_ROUNDS);

  const newUser = UserRepository.create({
    username: '',
    userCode: '',
    loginKeyHash: '',
    loginKeyLookup: '',
    adminName: env.ADMIN_NAME,
    passwordHash,
    role: UserRole.SUPER_ADMIN,
  });

  await UserRepository.save(newUser);

  logger.info(`Admin user seeded successfully — email: ${env.ADMIN_NAME}`);
};
