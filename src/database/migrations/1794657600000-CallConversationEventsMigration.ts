import { MigrationInterface, QueryRunner } from 'typeorm';

export class CallConversationEventsMigration1794657600000 implements MigrationInterface {
  name = 'CallConversationEventsMigration1794657600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "calls" ADD COLUMN "conversation_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "conversation_events" ADD COLUMN IF NOT EXISTS "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_call_conversation_event" ON "conversation_events" ((metadata ->> 'callId'), "type") WHERE "type" IN ('CALL_ACCEPTED', 'CALL_END') AND metadata ? 'callId'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "calls" DROP COLUMN "conversation_id"`);
    await queryRunner.query(`DROP INDEX "IDX_call_conversation_event"`);
    await queryRunner.query(`ALTER TABLE "conversation_events" DROP COLUMN "metadata"`);
  }
}
