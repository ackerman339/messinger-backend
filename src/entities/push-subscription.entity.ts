import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { PushPlatform, PushProvider } from '@appTypes';
import { User } from './user.entity';

@Entity('push_subscriptions')
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index('idx_push_subscriptions_user_id')
  userId: string;

  @ManyToOne(() => User, (user) => user.pushSubscriptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'varchar',
    length: 50,
  })
  platform: PushPlatform;

  @Column({
    type: 'varchar',
    length: 50,
  })
  provider: PushProvider;

  // Web Push
  @Column({ type: 'text', nullable: true })
  endpoint: string | null;

  @Column({ type: 'text', nullable: true })
  p256dh: string | null;

  @Column({ type: 'text', nullable: true })
  auth: string | null;

  // FCM / APNs / Expo token
  @Column({ type: 'text', nullable: true })
  token: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
