import { logger } from '@config/logger';
import { runSeeds } from '@database/seeds';

runSeeds().catch((error) => {
  logger.error('Error running seeds:', error);
  process.exit(1);
});
