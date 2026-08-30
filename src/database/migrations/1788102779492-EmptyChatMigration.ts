import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmptyChatMigration1788102779492 implements MigrationInterface {
  name = 'EmptyChatMigration1788102779492';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversation_members" ADD "empty_messages_at" TIMESTAMP WITH TIME ZONE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversation_members" DROP COLUMN "empty_messages_at"`);
  }
}
