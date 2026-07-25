import { AppDataSource } from '../src/config/database';
import { runSeeds } from '../src/database/seeds';

beforeAll(async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    await AppDataSource.runMigrations();
    await runSeeds(AppDataSource);
  }
});

afterAll(async () => {
  if (AppDataSource.isInitialized) {
    await AppDataSource.dropDatabase();
    await AppDataSource.destroy();
  }
});
