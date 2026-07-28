import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { ConversationRole } from '@appTypes';
import { Conversation } from './conversation.entity';
import { User } from './user.entity';

@Entity('conversation_members')
export class ConversationMember {
  @PrimaryColumn({
    type: 'uuid',
  })
  conversationId: string;

  @PrimaryColumn({
    type: 'uuid',
  })
  userId: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: ConversationRole.MEMBER,
  })
  role: ConversationRole;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Conversation, (conversation) => conversation.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'conversation_id',
  })
  conversation: Conversation;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
  })
  user: User;
}
