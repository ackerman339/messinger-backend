import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessageMigrationOnUserDeletion1787100739442 implements MigrationInterface {
  name = 'MessageMigrationOnUserDeletion1787100739442';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_22133395bd13b970ccd0c34ab22"`
    );
    await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "sender_id" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_22133395bd13b970ccd0c34ab22" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_22133395bd13b970ccd0c34ab22"`
    );
    await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "sender_id" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_22133395bd13b970ccd0c34ab22" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }
}
