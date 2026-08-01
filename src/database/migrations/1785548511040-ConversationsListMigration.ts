import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConversationsListMigration1785548511040 implements MigrationInterface {
  name = 'ConversationsListMigration1785548511040';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversation_members" ADD "unread_count" integer NOT NULL DEFAULT '0'`
    );
    await queryRunner.query(`ALTER TABLE "conversations" ADD "last_message_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_a53679287450d522a3f700088e9" FOREIGN KEY ("last_message_id") REFERENCES "messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_a53679287450d522a3f700088e9"`
    );
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "last_message_id"`);
    await queryRunner.query(`ALTER TABLE "conversation_members" DROP COLUMN "unread_count"`);
  }
}
