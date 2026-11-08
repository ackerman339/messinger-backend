import { MigrationInterface, QueryRunner } from 'typeorm';

export class CallsMigration1794004694733 implements MigrationInterface {
  name = 'CallsMigration1794004694733';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "calls" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "request_id" uuid NOT NULL, "caller_id" uuid NOT NULL, "callee_id" uuid NOT NULL, "caller_connection_id" uuid NOT NULL, "callee_connection_id" uuid, "current_negotiation_id" uuid, "media" character varying(50) NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'ringing', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "accepted_at" TIMESTAMP WITH TIME ZONE, "caller_connected_at" TIMESTAMP WITH TIME ZONE, "callee_connected_at" TIMESTAMP WITH TIME ZONE, "connected_at" TIMESTAMP WITH TIME ZONE, "ended_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE, "connection_expires_at" TIMESTAMP WITH TIME ZONE, "recovery_expires_at" TIMESTAMP WITH TIME ZONE, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_9a6dbf90297f0f1392947631e27" UNIQUE ("request_id"), CONSTRAINT "PK_d9171d91f8dd1a649659f1b6a20" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "call_negotiations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "request_id" uuid NOT NULL, "call_id" uuid NOT NULL, "offerer_id" uuid NOT NULL, "type" character varying(50) NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'PENDING', "offer_hash" character varying(64), "answer_hash" character varying(64), "offer_acknowledged_at" TIMESTAMP WITH TIME ZONE, "answer_acknowledged_at" TIMESTAMP WITH TIME ZONE, "caller_recovered_at" TIMESTAMP WITH TIME ZONE, "callee_recovered_at" TIMESTAMP WITH TIME ZONE, "recovered_at" TIMESTAMP WITH TIME ZONE, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "ended_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_2a977c856b05bf0bc966064339c" UNIQUE ("request_id"), CONSTRAINT "PK_6081ee145efeaad925eaaeabcba" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_call_negotiations_call_created" ON "call_negotiations"  ("call_id", "created_at") `
    );
    await queryRunner.query(
      `ALTER TABLE "calls" ADD CONSTRAINT "FK_8d8b052cf7b6c41b6081c28e3f7" FOREIGN KEY ("caller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "calls" ADD CONSTRAINT "FK_fbb74a6e36357bfec4f668b18ae" FOREIGN KEY ("callee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "call_negotiations" ADD CONSTRAINT "FK_deb6720db262f27bf700a86218e" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "call_negotiations" ADD CONSTRAINT "FK_6a210cb88b6a17d6efdfd33779c" FOREIGN KEY ("offerer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "call_negotiations" DROP CONSTRAINT "FK_6a210cb88b6a17d6efdfd33779c"`
    );
    await queryRunner.query(
      `ALTER TABLE "call_negotiations" DROP CONSTRAINT "FK_deb6720db262f27bf700a86218e"`
    );
    await queryRunner.query(`ALTER TABLE "calls" DROP CONSTRAINT "FK_fbb74a6e36357bfec4f668b18ae"`);
    await queryRunner.query(`ALTER TABLE "calls" DROP CONSTRAINT "FK_8d8b052cf7b6c41b6081c28e3f7"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_call_negotiations_call_created"`);
    await queryRunner.query(`DROP TABLE "call_negotiations"`);
    await queryRunner.query(`DROP TABLE "calls"`);
  }
}
