import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminMigration1786151449490 implements MigrationInterface {
  name = 'AdminMigration1786151449490';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "admin_name" character varying(255)`);
    await queryRunner.query(`ALTER TABLE "users" ADD "password_hash" character varying(255)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "password_hash"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "admin_name"`);
  }
}
