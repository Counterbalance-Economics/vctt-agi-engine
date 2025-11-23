
import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { InternalGoalExecutorService } from './internal-goal-executor.service';

/**
 * Real-Time Session Service - Phase 4.1 (FIXED)
 * 
 * Manages autonomous execution sessions using MIN's internal LLM cascade.
 * No external dependencies - pure internal execution with Grok/Claude/GPT cascade!
 */

export interface RealTimeSession {
  session_id: string;
  status: 'initializing' | 'running' | 'completed' | 'failed';
  created_at: Date;
  goal_context: any;
  progress?: number;
  result?: any;
  error?: string;
}

@Injectable()
export class RealTimeSessionService {
  private readonly logger = new Logger(RealTimeSessionService.name);
  
  // Track active sessions
  private activeSessions = new Map<string, RealTimeSession>();
  
  // Track running executions (prevents duplicate execution)
  private runningExecutions = new Set<string>();

  constructor(
    @Inject(forwardRef(() => InternalGoalExecutorService))
    private executor: InternalGoalExecutorService,
  ) {
    this.logger.log('🚀 Real-Time Session Service initialized - INTERNAL EXECUTION MODE');
  }

  /**
   * Spawn a new INTERNAL execution session for a goal
   */
  async spawnSession(goalId: number, goalTitle: string, goalDescription: string): Promise<RealTimeSession> {
    const sessionId = `session-${goalId}-${Date.now()}`;
    
    this.logger.log(`🌱 Spawning INTERNAL execution session for goal ${goalId}: ${goalTitle}`);

    // Check if already running
    if (this.runningExecutions.has(`goal-${goalId}`)) {
      this.logger.warn(`⚠️  Goal ${goalId} is already executing, returning existing session`);
      const existingSession = Array.from(this.activeSessions.values()).find(
        s => s.goal_context.goal_id === goalId && s.status === 'running'
      );
      if (existingSession) {
        return existingSession;
      }
    }

    const session: RealTimeSession = {
      session_id: sessionId,
      status: 'initializing',
      created_at: new Date(),
      goal_context: {
        goal_id: goalId,
        title: goalTitle,
        description: goalDescription,
        mode: 'reality', // Always reality mode with internal LLM cascade
      },
    };

    this.activeSessions.set(sessionId, session);
    this.runningExecutions.add(`goal-${goalId}`);

    // Execute goal asynchronously (don't block)
    this.executeGoalAsync(sessionId, goalId, goalTitle, goalDescription);

    this.logger.log(`✅ Internal execution session spawned: ${sessionId}`);

    return session;
  }

  /**
   * Execute goal in background using internal LLM cascade
   */
  private async executeGoalAsync(
    sessionId: string,
    goalId: number,
    goalTitle: string,
    goalDescription: string
  ) {
    try {
      // Update status to running
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.status = 'running';
        this.activeSessions.set(sessionId, session);
      }

      this.logger.log(`⚡ Executing goal ${goalId} with internal LLM cascade...`);

      // Execute using internal executor
      const result = await this.executor.executeGoal(goalId, goalTitle, goalDescription, sessionId);

      // Update session with result
      if (this.activeSessions.has(sessionId)) {
        const updatedSession = this.activeSessions.get(sessionId)!;
        updatedSession.status = result.success ? 'completed' : 'failed';
        updatedSession.result = result;
        updatedSession.progress = 100;
        if (!result.success && result.error) {
          updatedSession.error = result.error;
        }
        this.activeSessions.set(sessionId, updatedSession);
      }

      this.logger.log(
        `${result.success ? '✅' : '❌'} Goal ${goalId} execution ${result.success ? 'completed' : 'failed'} - Cost: $${result.cost_usd.toFixed(4)}, Models: ${result.models_used.join(', ')}`
      );

    } catch (error) {
      this.logger.error(`❌ Internal execution failed for goal ${goalId}: ${error.message}`, error.stack);

      // Update session with error
      if (this.activeSessions.has(sessionId)) {
        const updatedSession = this.activeSessions.get(sessionId)!;
        updatedSession.status = 'failed';
        updatedSession.error = error.message;
        this.activeSessions.set(sessionId, updatedSession);
      }
    } finally {
      // Remove from running set
      this.runningExecutions.delete(`goal-${goalId}`);
    }
  }

  /**
   * Check session status
   */
  async getSessionStatus(sessionId: string): Promise<RealTimeSession | null> {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Complete a session
   */
  async completeSession(sessionId: string, result: any): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.result = result;
      session.progress = 100;
      this.activeSessions.set(sessionId, session);
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): RealTimeSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Clean up old sessions
   */
  cleanupOldSessions(maxAgeHours: number = 24): void {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.created_at < cutoff && session.status !== 'running') {
        this.activeSessions.delete(sessionId);
        this.logger.debug(`🧹 Cleaned up old session: ${sessionId}`);
      }
    }
  }
}
