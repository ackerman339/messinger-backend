import type { MigrationInterface, QueryRunner } from 'typeorm';

export class GroupCallRingingMigration1795001000000 implements MigrationInterface {
  name = 'GroupCallRingingMigration1795001000000';

  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`
      ALTER TABLE "group_calls"
        ADD COLUMN "ringing_until" timestamptz,
        ADD COLUMN "ringing_user_ids" uuid[] NOT NULL DEFAULT '{}'
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_group_calls_ringing_until" ON "group_calls" ("ringing_until")
      WHERE "ringing_until" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query('DROP INDEX "idx_group_calls_ringing_until"');
    await queryRunner.query(
      'ALTER TABLE "group_calls" DROP COLUMN "ringing_user_ids", DROP COLUMN "ringing_until"'
    );
  }
}
