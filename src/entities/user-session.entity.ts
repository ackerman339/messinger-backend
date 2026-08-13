import {
  PrimaryGeneratedColumn,
  Entity,
  ManyToOne,
  Column,
  CreateDateColumn,
  JoinColumn,
  Index,
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
  @Index('idx_user_sessions_user_id')
  userId: string;

  @Column({ type: 'text', unique: true })
  @Index('idx_user_sessions_refresh_token_hash')
  refreshTokenHash: string;

  @Column({ type: 'inet', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

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

  @Column({ type: 'text', nullable: true })
  previousRefreshTokenHash: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  rotatedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rotatedAccessToken: string | null;

  @Column({ type: 'text', nullable: true })
  rotatedRefreshToken: string | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;
}
