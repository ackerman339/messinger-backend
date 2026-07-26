import {
  PrimaryGeneratedColumn,
  Entity,
  ManyToOne,
  Column,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';

import { SessionRevokeReason } from '@appTypes';
import { User } from './user.entity';

@Entity({ name: 'user_sessions' })
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'text', unique: true })
  refreshTokenHash: string;

  @Column({ type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text' })
  userAgent: string;

  @Column({ type: 'boolean', default: false })
  isRevoked: boolean;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  revokedReason: SessionRevokeReason | null;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;
}
