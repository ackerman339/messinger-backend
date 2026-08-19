import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserMigration1787111156694 implements MigrationInterface {
  name = 'UserMigration1787111156694';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "username" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "login_key_hash" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "login_key_lookup" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "user_code" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "pending_uploads" ADD CONSTRAINT "FK_515bac48c679d1f3c06d5a0ee81" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pending_uploads" DROP CONSTRAINT "FK_515bac48c679d1f3c06d5a0ee81"`
    );
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "user_code" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "login_key_lookup" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "login_key_hash" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL`);
  }
}
