import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessageReceiptsMigration1795002000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE messages ADD COLUMN client_message_id uuid');
    await queryRunner.query(
      'CREATE UNIQUE INDEX uq_messages_sender_client_id ON messages (sender_id, client_message_id)'
    );
    await queryRunner.query(
      'CREATE INDEX idx_message_deliveries_user_status ON message_deliveries (user_id, status)'
    );
    // The old sync marked deliveries without a client acknowledgement or timestamp.
    await queryRunner.query(`
      UPDATE message_deliveries SET status = 'SENT'
      WHERE status = 'DELIVERED' AND delivered_at IS NULL
    `);
    await queryRunner.query(`
      UPDATE message_deliveries SET delivered_at = read_at
      WHERE status = 'READ' AND delivered_at IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX idx_message_deliveries_user_status');
    await queryRunner.query('DROP INDEX uq_messages_sender_client_id');
    await queryRunner.query('ALTER TABLE messages DROP COLUMN client_message_id');
  }
}
