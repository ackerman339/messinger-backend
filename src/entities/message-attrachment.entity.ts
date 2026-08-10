import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { Message } from './message.entity';

@Entity('message_attachments')
export class MessageAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_message_attachments_message_id')
  @Column({
    type: 'uuid',
  })
  messageId: string;

  @ManyToOne(() => Message, (message) => message.attachments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'message_id' })
  message: Message;

  /**
   * Object key inside R2.
   *
   * The object stored in R2 is encrypted.
   */
  @Column({
    type: 'varchar',
    length: 500,
  })
  storageKey: string;

  /**
   * Original filename.
   * Used only for the client/UI.
   */
  @Column({
    type: 'varchar',
    length: 255,
  })
  fileName: string;

  /**
   * MIME type of the original file,
   * before encryption.
   */
  @Column({
    type: 'varchar',
    length: 100,
  })
  contentType: string;

  /**
   * Size of the original file in bytes.
   */
  @Column({
    type: 'bigint',
  })
  size: number;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;
}
