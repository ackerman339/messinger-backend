import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { ConversationType } from '@appTypes';
import { ConversationMember } from './conversation-member.entity';
import { Message } from './message.entity';
import { ConversationEvent } from './conversation-event.entity';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // onlu applies to private conversations
  @Column({
    type: 'char',
    length: 64,
    nullable: true,
    unique: true,
  })
  privateKey: string | null;

  // only applies to groups
  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  name: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: ConversationType.PRIVATE,
  })
  type: ConversationType;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  lastMessageId: string | null;

  @ManyToOne(() => Message, {
    nullable: true,
  })
  @JoinColumn({
    name: 'last_message_id',
  })
  lastMessage: Message | null;

  @OneToMany(() => ConversationMember, (member) => member.conversation, {
    cascade: true,
  })
  members: ConversationMember[];

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];

  @OneToMany(() => ConversationEvent, (event) => event.conversation)
  events: ConversationEvent[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
