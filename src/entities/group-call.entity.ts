import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { CallMedia } from '@appTypes';
import { Conversation } from './conversation.entity';

@Entity('group_calls')
@Index('uq_group_calls_active_conversation', ['conversationId'], {
  unique: true,
  where: '"ended_at" IS NULL',
})
export class GroupCall {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid')
  conversationId: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column('uuid')
  startedBy: string;

  @Column({ type: 'varchar', length: 5 })
  media: CallMedia;

  @Column('varchar')
  roomSid: string;

  @Column({ type: 'timestamptz', nullable: true })
  ringingUntil: Date | null;

  @Column({ type: 'uuid', array: true, default: '{}' })
  ringingUserIds: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt: Date | null;
}
