import { AppDataSource } from '../data-source';
import { logger } from '@config/logger';
import { adminSeed } from './admin';

export const runSeeds = async (dataSource: typeof AppDataSource = AppDataSource) => {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
    logger.info('Database connected successfully, seeds can run');
  }

  logger.info('Running seeds...');
  await adminSeed(dataSource);
  logger.info('All seeds executed successfully');
};
