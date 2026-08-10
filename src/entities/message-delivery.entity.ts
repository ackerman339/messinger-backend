import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { MessageStatus } from '@appTypes';
import { Message } from './message.entity';

@Entity('message_deliveries')
@Index('idx_message_deliveries_message_id_user_id', ['messageId', 'userId'])
export class MessageDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  messageId: string;

  @ManyToOne(() => Message, (message) => message.deliveries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'message_id',
  })
  message: Message;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: MessageStatus.SENT,
  })
  status: MessageStatus;

  @Column({
    nullable: true,
    type: 'timestamptz',
  })
  deliveredAt: Date | null;

  @Column({
    nullable: true,
    type: 'timestamptz',
  })
  readAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
