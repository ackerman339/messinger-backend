import { MigrationInterface, QueryRunner } from 'typeorm';

export class FilesMigration1785801190513 implements MigrationInterface {
  name = 'FilesMigration1785801190513';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "message_attachments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "message_id" uuid NOT NULL, "storage_key" character varying(500) NOT NULL, "file_name" character varying(255) NOT NULL, "content_type" character varying(100) NOT NULL, "size" bigint NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e5085d973567c61e9306f10f95b" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bf65c3db8657cef6197b68b8c8" ON "message_attachments"  ("message_id") `
    );
    await queryRunner.query(
      `CREATE TABLE "pending_uploads" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "storage_key" character varying(500) NOT NULL, "file_name" character varying(255) NOT NULL, "content_type" character varying(100) NOT NULL, "size" bigint NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_07a490fb3ae5ce47e78d5558df3" UNIQUE ("storage_key"), CONSTRAINT "PK_d0e9b5ff2b7d70fc4bca7708d0c" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_515bac48c679d1f3c06d5a0ee8" ON "pending_uploads"  ("user_id") `
    );
    await queryRunner.query(
      `ALTER TABLE "message_attachments" ADD CONSTRAINT "FK_bf65c3db8657cef6197b68b8c88" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "message_attachments" DROP CONSTRAINT "FK_bf65c3db8657cef6197b68b8c88"`
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_515bac48c679d1f3c06d5a0ee8"`);
    await queryRunner.query(`DROP TABLE "pending_uploads"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_bf65c3db8657cef6197b68b8c8"`);
    await queryRunner.query(`DROP TABLE "message_attachments"`);
  }
}
