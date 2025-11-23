
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Goal } from './goal.entity';

@Entity('goal_artifacts')
export class Artifact {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'goal_id' })
  goalId: number;

  @Column({ name: 'artifact_type', length: 50 })
  artifactType: string; // code, url, file, screenshot, document, deployment

  @Column({ name: 'artifact_name', length: 500 })
  artifactName: string;

  @Column({ name: 'artifact_description', type: 'text', nullable: true })
  artifactDescription?: string;

  @Column({ name: 'artifact_path', type: 'text', nullable: true })
  artifactPath?: string;

  @Column({ name: 'artifact_data', type: 'text', nullable: true })
  artifactData?: string;

  @Column({ name: 'file_size', nullable: true })
  fileSize?: number;

  @Column({ name: 'mime_type', length: 100, nullable: true })
  mimeType?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ name: 'created_by', length: 100, default: 'min' })
  createdBy: string;

  @ManyToOne(() => Goal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'goal_id' })
  goal: Goal;
}
