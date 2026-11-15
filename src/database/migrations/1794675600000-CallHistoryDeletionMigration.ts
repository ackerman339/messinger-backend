import { MigrationInterface, QueryRunner } from 'typeorm';

export class CallHistoryDeletionMigration1794675600000 implements MigrationInterface {
  name = 'CallHistoryDeletionMigration1794675600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "calls" ADD "caller_history_deleted_at" timestamptz, ADD "callee_history_deleted_at" timestamptz`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "calls" DROP COLUMN "callee_history_deleted_at", DROP COLUMN "caller_history_deleted_at"`
    );
  }
}
