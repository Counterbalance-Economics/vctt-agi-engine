
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';

/**
 * LLM Contribution Entity
 * 
 * Tracks every LLM invocation during the VCTT pipeline:
 * - Which model was used
 * - Which agent requested it
 * - Whether it succeeded/failed
 * - Error details if applicable
 * 
 * This enables the "LLM Committee" transparency panel,
 * showing humans exactly which models are doing the work.
 */
@Entity('llm_contributions')
export class LLMContribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  session_id: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  conversation: Conversation;

  @Column({ type: 'uuid', nullable: true })
  message_id: string;

  @ManyToOne(() => Message, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'message_id' })
  message: Message;

  @Column({ type: 'varchar', length: 50 })
  model_name: string; // 'grok-4.1', 'claude-3.5', 'gpt-5', etc.

  @Column({ type: 'varchar', length: 50 })
  agent_name: string; // 'analyst', 'relational', 'ethics', 'synthesiser', 'verification'

  @Column({ type: 'boolean', default: false })
  contributed: boolean; // True if this model provided output that was used

  @Column({ type: 'boolean', default: false })
  offline: boolean; // True if 4xx/5xx/timeout/parsing error

  @Column({ type: 'varchar', length: 100, nullable: true })
  error_type: string; // 'timeout', '4xx', '5xx', 'parsing_error', 'fallback'

  @Column({ type: 'integer', default: 0 })
  tokens_used: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0 })
  cost_usd: number;

  @Column({ type: 'integer', default: 0 })
  latency_ms: number;

  @CreateDateColumn()
  timestamp: Date;
}
