import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from '@utils';
import { TypeOrmLogger } from '@logging';

import * as Entities from '@entities';
import * as Migrations from '@database/migrations';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  logger: new TypeOrmLogger(),
  entities: Object.values(Entities),
  migrations: Object.values(Migrations),
  migrationsTransactionMode: 'each',
});
