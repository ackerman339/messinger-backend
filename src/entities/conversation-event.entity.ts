import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

import { ConversationEventType } from '@appTypes';
import { Conversation } from './conversation.entity';

@Entity('conversation_events')
@Index(['conversationId', 'createdAt'])
export class ConversationEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'uuid',
  })
  conversationId: string;

  @ManyToOne(() => Conversation, (conversation) => conversation.events, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'conversation_id',
  })
  conversation: Conversation;

  // User who performed the action.
  @Column({
    type: 'uuid',
  })
  actorId: string;

  // User affected by the action. Null only for GROUP_CREATED and MEMBER_JOINED
  @Column({
    type: 'uuid',
    nullable: true,
  })
  targetUserId: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: ConversationEventType.GROUP_CREATED,
  })
  type: ConversationEventType;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;
}
