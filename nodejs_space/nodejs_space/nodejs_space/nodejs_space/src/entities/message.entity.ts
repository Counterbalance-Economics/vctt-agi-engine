

import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { Conversation } from './conversation.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversation_id: string;

  @Column()
  role: 'user' | 'assistant' | 'system';

  @Column('text')
  content: string;

  @CreateDateColumn()
  timestamp: Date;

  // LLM metadata (only for assistant messages)
  @Column({ type: 'varchar', nullable: true })
  model?: string;

  @Column({ type: 'int', nullable: true })
  tokens_input?: number;

  @Column({ type: 'int', nullable: true })
  tokens_output?: number;

  @Column({ type: 'int', nullable: true })
  tokens_total?: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  cost_usd?: number;

  @Column({ type: 'int', nullable: true })
  latency_ms?: number;

  @ManyToOne(() => Conversation, conv => conv.messages)
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;
}
