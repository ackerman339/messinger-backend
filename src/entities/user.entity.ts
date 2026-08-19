import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';

import { UserRole, UserStatus } from '@appTypes';
import { Session } from './user-session.entity';
import { PushSubscription } from './push-subscription.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  username: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  loginKeyHash: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    unique: true,
    nullable: true,
  })
  loginKeyLookup: string | null;

  @Column({
    type: 'varchar',
    length: 10,
    unique: true,
    nullable: true,
  })
  @Index('idx_user_code')
  userCode: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  avatarUrl: string | null;

  @Column({
    type: 'varchar',
    length: 50,
  })
  role: UserRole;

  @Column({
    type: 'varchar',
    length: 50,
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  adminName: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  passwordHash: string | null;

  @Index('idx_last_seen_at')
  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  lastSeenAt: Date | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date;

  @DeleteDateColumn({
    type: 'timestamptz',
    nullable: true,
  })
  deletedAt: Date | null;

  @OneToMany(() => Session, (session) => session.user)
  sessions: Session[];

  @OneToMany(() => PushSubscription, (pushSubscription) => pushSubscription.user)
  pushSubscriptions: PushSubscription[];
}
