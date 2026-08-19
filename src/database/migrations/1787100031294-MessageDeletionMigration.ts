import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessageDeletionMigration1787100031294 implements MigrationInterface {
  name = 'MessageDeletionMigration1787100031294';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_a53679287450d522a3f700088e9"`
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_a53679287450d522a3f700088e9" FOREIGN KEY ("last_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_a53679287450d522a3f700088e9"`
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_a53679287450d522a3f700088e9" FOREIGN KEY ("last_message_id") REFERENCES "messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }
}
