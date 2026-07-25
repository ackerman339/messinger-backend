import { DataSource } from 'typeorm';
import { env } from './environment';
import { SnakeNamingStrategy } from '@utils';
import { TypeOrmLogger } from '@logging';

import * as Entities from '@entities';
import * as Migrations from '@database/migrations';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
  logging: env.NODE_ENV === 'development',
  logger: new TypeOrmLogger(),
  entities: Object.values(Entities),
  migrations: Object.values(Migrations),
});
