import { AppDataSource } from '../data-source';
import { logger } from '@config/logger';

export const runSeeds = async (dataSource: typeof AppDataSource = AppDataSource) => {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
    logger.info('Database connected successfully, seeds can run');
  }

  /*
    logger.info('Running seeds...');
    Add your seeds here
    logger.info('All seeds executed successfully');
  */
};
