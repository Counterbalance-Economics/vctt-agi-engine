
import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

export interface SIMState {
  tension: number;
  uncertainty: number;
  emotional_intensity: number;
}

export interface StateData {
  sim: SIMState;
  contradiction: number;
  regulation: 'normal' | 'clarify' | 'slow_down';
  trust_tau: number;
  repair_count: number;
}

@Entity('internal_state')
export class InternalState {
  @PrimaryColumn()
  session_id: string;

  @Column('jsonb')
  state: StateData;

  @UpdateDateColumn()
  updated_at: Date;
}
