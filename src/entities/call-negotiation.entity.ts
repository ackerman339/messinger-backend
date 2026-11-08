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

import { CallNegotiationStatus, CallNegotiationType } from '@appTypes';

import { Call } from './call.entity';
import { User } from './user.entity';

@Entity('call_negotiations')
@Index('IDX_call_negotiations_call_created', ['callId', 'createdAt'])
export class CallNegotiation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'uuid',
    unique: true,
  })
  requestId: string;

  @Column({ type: 'uuid' })
  callId: string;

  @ManyToOne(() => Call, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'call_id' })
  call: Call;

  @Column({ type: 'uuid' })
  offererId: string;

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'offerer_id' })
  offerer: User;

  @Column({ type: 'varchar', length: 50 })
  type: CallNegotiationType;

  @Column({
    type: 'varchar',
    length: 50,
    default: CallNegotiationStatus.PENDING,
  })
  status: CallNegotiationStatus;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  offerHash: string | null;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  answerHash: string | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  offerAcknowledgedAt: Date | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  answerAcknowledgedAt: Date | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  callerRecoveredAt: Date | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  calleeRecoveredAt: Date | null;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  recoveredAt: Date | null;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({
    type: 'timestamptz',
    nullable: true,
  })
  endedAt: Date | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
