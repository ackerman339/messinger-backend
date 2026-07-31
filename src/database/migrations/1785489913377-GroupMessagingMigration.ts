import { MigrationInterface, QueryRunner } from 'typeorm';

export class GroupMessagingMigration1785489913377 implements MigrationInterface {
  name = 'GroupMessagingMigration1785489913377';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "conversation_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversation_id" uuid NOT NULL, "actor_id" uuid NOT NULL, "target_user_id" uuid, "type" character varying(50) NOT NULL DEFAULT 'GROUP_CREATED', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d69d1aeac5bf8d33983a582653d" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a6dfae8c6391d70fda8dde2812" ON "conversation_events"  ("conversation_id", "created_at") `
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_members" ADD "soft_deleted_at" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_members" ADD "restored_at" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_events" ADD CONSTRAINT "FK_ba970f7c2f1f3d96bcfbda1a998" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "conversation_events" DROP CONSTRAINT "FK_ba970f7c2f1f3d96bcfbda1a998"`
    );
    await queryRunner.query(`ALTER TABLE "conversation_members" DROP COLUMN "restored_at"`);
    await queryRunner.query(`ALTER TABLE "conversation_members" DROP COLUMN "soft_deleted_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_a6dfae8c6391d70fda8dde2812"`);
    await queryRunner.query(`DROP TABLE "conversation_events"`);
  }
}
