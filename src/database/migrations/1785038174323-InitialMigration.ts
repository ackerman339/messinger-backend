import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1785038174323 implements MigrationInterface {
  name = 'InitialMigration1785038174323';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "refresh_token_hash" text NOT NULL, "ip_address" inet, "user_agent" text NOT NULL, "is_revoked" boolean NOT NULL DEFAULT false, "revoked_reason" character varying(50), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_cc132fa5f7a96610010e293e526" UNIQUE ("refresh_token_hash"), CONSTRAINT "PK_e93e031a5fed190d4789b6bfd83" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying(100) NOT NULL, "login_key_hash" text NOT NULL, "login_key_lookup" character varying(64) NOT NULL, "user_code" character varying(10) NOT NULL, "avatar_url" text, "role" character varying(50) NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'active', "last_seen_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_bff3a20e63af898ea9f67df1f62" UNIQUE ("login_key_lookup"), CONSTRAINT "UQ_23351656ab098559729ac15f50a" UNIQUE ("user_code"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(`CREATE INDEX "idx_last_seen_at" ON "users"  ("last_seen_at") `);
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_e9658e959c490b0a634dfc54783" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_e9658e959c490b0a634dfc54783"`
    );
    await queryRunner.query(`DROP INDEX "public"."idx_last_seen_at"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "user_sessions"`);
  }
}
