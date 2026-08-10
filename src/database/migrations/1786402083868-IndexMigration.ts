import { MigrationInterface, QueryRunner } from 'typeorm';

export class IndexMigration1786402083868 implements MigrationInterface {
  name = 'IndexMigration1786402083868';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_bf65c3db8657cef6197b68b8c8"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_515bac48c679d1f3c06d5a0ee8"`);
    await queryRunner.query(`ALTER TABLE "user_sessions" ALTER COLUMN "user_agent" DROP NOT NULL`);
    await queryRunner.query(
      `CREATE INDEX "idx_user_sessions_user_id" ON "user_sessions"  ("user_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_user_sessions_refresh_token_hash" ON "user_sessions"  ("refresh_token_hash") `
    );
    await queryRunner.query(`CREATE INDEX "idx_user_code" ON "users"  ("user_code") `);
    await queryRunner.query(
      `CREATE INDEX "idx_message_deliveries_message_id_user_id" ON "message_deliveries"  ("message_id", "user_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conversation_members_conversation_id_soft_deleted_at" ON "conversation_members"  ("conversation_id", "soft_deleted_at") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conversation_members_conversation_id_user_id" ON "conversation_members"  ("conversation_id", "user_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_conversation_updated_at" ON "conversations"  ("updated_at") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_message_attachments_message_id" ON "message_attachments"  ("message_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_messages_conversation_id_user_id" ON "messages"  ("conversation_id", "created_at") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_group_invitations_conversation_id_user_id" ON "group_invitations"  ("conversation_id", "target_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "idx_pending_upload_user_id" ON "pending_uploads"  ("user_id") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_pending_upload_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_group_invitations_conversation_id_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_messages_conversation_id_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_message_attachments_message_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_conversation_updated_at"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_conversation_members_conversation_id_user_id"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_conversation_members_conversation_id_soft_deleted_at"`
    );
    await queryRunner.query(`DROP INDEX "public"."idx_message_deliveries_message_id_user_id"`);
    await queryRunner.query(`DROP INDEX "public"."idx_user_code"`);
    await queryRunner.query(`DROP INDEX "public"."idx_user_sessions_refresh_token_hash"`);
    await queryRunner.query(`DROP INDEX "public"."idx_user_sessions_user_id"`);
    await queryRunner.query(`ALTER TABLE "user_sessions" ALTER COLUMN "user_agent" SET NOT NULL`);
    await queryRunner.query(
      `CREATE INDEX "IDX_515bac48c679d1f3c06d5a0ee8" ON "pending_uploads" USING btree ("user_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bf65c3db8657cef6197b68b8c8" ON "message_attachments" USING btree ("message_id") `
    );
  }
}
