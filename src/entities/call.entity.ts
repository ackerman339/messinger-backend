import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from './user.entity';
import { CallMedia, CallStatus } from '@appTypes';

@Entity('calls')
export class Call {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'uuid',
    unique: true,
  })
  requestId: string;

  @Column({ type: 'uuid' })
  callerId: string;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'caller_id' })
  caller: User;

  @Column({ name: 'callee_id', type: 'uuid' })
  calleeId: string;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'callee_id' })
  callee: User;

  @Column({ type: 'uuid' })
  callerConnectionId: string;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  calleeConnectionId: string | null;

  @Column({
    type: 'uuid',
    nullable: true,
  })
  currentNegotiationId: string | null;

  @Column({ type: 'varchar', length: 50 })
  media: CallMedia;

  @Column({
    type: 'varchar',
    length: 50,
    default: CallStatus.RINGING,
  })
  status: CallStatus;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  acceptedAt: Date | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  callerConnectedAt: Date | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  calleeConnectedAt: Date | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  connectedAt: Date | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  endedAt: Date | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  expiresAt: Date | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  connectionExpiresAt: Date | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  recoveryExpiresAt: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
