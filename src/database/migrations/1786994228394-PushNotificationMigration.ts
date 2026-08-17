import { MigrationInterface, QueryRunner } from 'typeorm';

export class PushNotificationMigration1786994228394 implements MigrationInterface {
  name = 'PushNotificationMigration1786994228394';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "push_subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "platform" character varying(50) NOT NULL, "provider" character varying(50) NOT NULL, "endpoint" text, "p256dh" text, "auth" text, "token" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_757fc8f00c34f66832668dc2e53" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "idx_push_subscriptions_user_id" ON "push_subscriptions"  ("user_id") `
    );
    await queryRunner.query(
      `ALTER TABLE "push_subscriptions" ADD CONSTRAINT "FK_6771f119f1c06d2ccf38f238664" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "push_subscriptions" DROP CONSTRAINT "FK_6771f119f1c06d2ccf38f238664"`
    );
    await queryRunner.query(`DROP INDEX "public"."idx_push_subscriptions_user_id"`);
    await queryRunner.query(`DROP TABLE "push_subscriptions"`);
  }
}
