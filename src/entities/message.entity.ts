import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

import { User } from './user.entity';
import { MessageDelivery } from './message-delivery.entity';
import { Conversation } from './conversation.entity';
import { MessageAttachment } from './message-attrachment.entity';

@Entity('messages')
@Index('idx_messages_conversation_id_user_id', ['conversationId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'uuid',
  })
  conversationId: string;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  senderId: string;

  @Column({
    type: 'text',
  })
  cipheredContent: string;

  @Column({
    type: 'varchar',
    length: 24,
  })
  iv: string;

  @Column({
    type: 'varchar',
    length: 32,
  })
  authTag: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => MessageDelivery, (delivery) => delivery.message)
  deliveries: MessageDelivery[];

  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'conversation_id',
  })
  conversation: Conversation;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({
    name: 'sender_id',
  })
  sender: User;

  @OneToMany(() => MessageAttachment, (attachment) => attachment.message, {
    cascade: true,
  })
  attachments: MessageAttachment[];
}
