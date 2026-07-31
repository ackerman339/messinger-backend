import { MigrationInterface, QueryRunner } from 'typeorm';

export class OfflineSyncMigration1785539774890 implements MigrationInterface {
  name = 'OfflineSyncMigration1785539774890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "group_invitations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "conversation_id" uuid NOT NULL, "actor_id" uuid NOT NULL, "target_id" uuid NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'PENDING', "expires_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f7d0b290d6079ae9353d794227d" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "group_invitations" ADD CONSTRAINT "FK_eeddfe341909d41cc46a47ad9fb" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "group_invitations" ADD CONSTRAINT "FK_ed160c4f3dbeb108c78737fdc44" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "group_invitations" ADD CONSTRAINT "FK_cc29bdf33812b3920331474734d" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "group_invitations" DROP CONSTRAINT "FK_cc29bdf33812b3920331474734d"`
    );
    await queryRunner.query(
      `ALTER TABLE "group_invitations" DROP CONSTRAINT "FK_ed160c4f3dbeb108c78737fdc44"`
    );
    await queryRunner.query(
      `ALTER TABLE "group_invitations" DROP CONSTRAINT "FK_eeddfe341909d41cc46a47ad9fb"`
    );
    await queryRunner.query(`DROP TABLE "group_invitations"`);
  }
}
