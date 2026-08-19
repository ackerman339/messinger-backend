import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
@Entity('pending_uploads')
export class PendingUpload {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_pending_upload_user_id')
  @Column({
    type: 'uuid',
  })
  userId: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
  })
  user: User;

  @Column({
    type: 'varchar',
    length: 500,
    unique: true,
  })
  storageKey: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  fileName: string;

  @Column({
    type: 'varchar',
    length: 100,
  })
  contentType: string;

  @Column({
    type: 'bigint',
  })
  size: number;

  @Column({
    type: 'timestamptz',
  })
  expiresAt: Date;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;
}
