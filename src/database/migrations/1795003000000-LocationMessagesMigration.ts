import { MigrationInterface, QueryRunner } from 'typeorm';

export class LocationMessagesMigration1795003000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE messages ADD COLUMN is_location boolean NOT NULL DEFAULT false,
        ADD COLUMN location_expires_at timestamptz, ADD COLUMN location_stopped_at timestamptz
    `);
    await queryRunner.query(`
      CREATE INDEX idx_messages_location_expiration ON messages (location_expires_at)
      WHERE location_expires_at IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX idx_messages_location_expiration');
    await queryRunner.query(`
      ALTER TABLE messages DROP COLUMN is_location, DROP COLUMN location_expires_at,
        DROP COLUMN location_stopped_at
    `);
  }
}
