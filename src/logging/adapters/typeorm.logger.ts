import { Logger, QueryRunner } from 'typeorm';
import { logger } from '@config/logger';

const formatQuery = (query: string) => {
  return query.replace(/\s+/g, ' ').trim();
};

export class TypeOrmLogger implements Logger {
  logQuery(query: string, parameters?: unknown[]) {
    logger.debug('DB Query', {
      query: formatQuery(query),
      parameters,
    });
  }

  logQueryError(error: string, query: string, parameters?: unknown[]) {
    logger.error('DB Query Error', {
      error,
      query: formatQuery(query),
      parameters,
    });
  }

  logQuerySlow(time: number, query: string, parameters?: unknown[]) {
    logger.warn('Slow Query', {
      time: `${time}ms`,
      query: formatQuery(query),
      parameters,
    });
  }

  log(level: 'log' | 'info' | 'warn', message: unknown) {
    const mappedLevel = level === 'log' ? 'info' : level;
    logger[mappedLevel]('TypeORM', {
      message,
    });
  }

  logSchemaBuild(message: string, _queryRunner?: QueryRunner) {
    logger.info('Schema Build', { message });
  }

  logMigration(message: string, _queryRunner?: QueryRunner) {
    logger.info('Migration', { message });
  }
}
