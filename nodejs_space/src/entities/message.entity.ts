
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

  @ManyToOne(() => Conversation, conv => conv.messages)
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;
}
