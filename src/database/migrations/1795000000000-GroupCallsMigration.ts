import { MigrationInterface, QueryRunner } from 'typeorm';

export class GroupCallsMigration1795000000000 implements MigrationInterface {
  name = 'GroupCallsMigration1795000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "group_calls" (
        "id" uuid PRIMARY KEY,
        "conversation_id" uuid NOT NULL REFERENCES "conversations" ("id") ON DELETE CASCADE,
        "started_by" uuid NOT NULL,
        "media" varchar(5) NOT NULL CHECK ("media" IN ('audio', 'video')),
        "room_sid" varchar NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "ended_at" timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_group_calls_active_conversation"
      ON "group_calls" ("conversation_id") WHERE "ended_at" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "group_calls"');
  }
}
