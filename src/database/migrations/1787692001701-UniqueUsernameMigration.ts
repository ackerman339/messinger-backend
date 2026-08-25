import { MigrationInterface, QueryRunner } from 'typeorm';

export class UniqueUsernameMigration1787692001701 implements MigrationInterface {
  name = 'UniqueUsernameMigration1787692001701';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username")`
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_fe410359fd5cb524059a210ddf0" UNIQUE ("admin_name")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_fe410359fd5cb524059a210ddf0"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710"`);
  }
}
