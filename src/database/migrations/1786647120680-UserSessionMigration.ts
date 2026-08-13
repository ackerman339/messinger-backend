import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserSessionMigration1786647120680 implements MigrationInterface {
  name = 'UserSessionMigration1786647120680';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_sessions" ADD "previous_refresh_token_hash" text`);
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD "rotated_at" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(`ALTER TABLE "user_sessions" ADD "rotated_access_token" text`);
    await queryRunner.query(`ALTER TABLE "user_sessions" ADD "rotated_refresh_token" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_sessions" DROP COLUMN "rotated_refresh_token"`);
    await queryRunner.query(`ALTER TABLE "user_sessions" DROP COLUMN "rotated_access_token"`);
    await queryRunner.query(`ALTER TABLE "user_sessions" DROP COLUMN "rotated_at"`);
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP COLUMN "previous_refresh_token_hash"`
    );
  }
}
