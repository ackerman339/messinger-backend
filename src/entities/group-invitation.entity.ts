import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { GroupInvitationStatus } from '@appTypes';
import { User } from './user.entity';
import { Conversation } from './conversation.entity';

@Entity('group_invitations')
@Index('idx_group_invitations_conversation_id_user_id', ['conversationId', 'targetId'])
export class GroupInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'uuid',
  })
  conversationId: string;

  @ManyToOne(() => Conversation, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'conversation_id',
  })
  conversation: Conversation;

  @Column({
    type: 'uuid',
  })
  actorId: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'actor_id',
  })
  actor: User;

  @Column({
    type: 'uuid',
  })
  targetId: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'target_id',
  })
  target: User;

  @Column({
    type: 'varchar',
    length: 50,
    default: GroupInvitationStatus.PENDING,
  })
  status: GroupInvitationStatus;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  expiresAt: Date;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date;
}
