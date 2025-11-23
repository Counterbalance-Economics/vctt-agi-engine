
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal } from '../entities/goal.entity';
import { Subtask } from '../entities/subtask.entity';
import { RealTimeSessionService } from './realtime-session.service';
import { LLMCoachService } from './llm-coach.service';
import { PriorityEngineService } from './priority-engine.service';
import { AutonomousGateway } from '../gateways/autonomous.gateway';

/**
 * Autonomous Orchestrator Service - Phase 4
 * 
 * The brain of MIN's autonomous execution system with FULL REALITY MODE:
 * - Real DeepAgent session spawning
 * - LLM-powered coach analysis
 * - Dynamic auto-prioritization
 * - Swarm Mode (3→10 parallel sessions)
 * - Real-time WebSocket updates
 */

export interface ExecutionQueueItem {
  id: number;
  goal_id: number;
  subtask_id?: number;
  priority: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  attempts: number;
  max_attempts: number;
  assigned_agent?: string;
  session_id?: string;
  error_message?: string;
  queued_at: Date;
  started_at?: Date;
  completed_at?: Date;
  metadata?: any;
}

export interface AgentPoolEntry {
  id: number;
  agent_id: string;
  agent_type: string;
  status: 'idle' | 'busy' | 'offline' | 'error';
  current_task_id?: number;
  capabilities: string[];
  max_parallel_tasks: number;
  current_load: number;
  last_heartbeat: Date;
}

@Injectable()
export class AutonomousOrchestratorService {
  private readonly logger = new Logger(AutonomousOrchestratorService.name);
  private isRunning = false;
  
  // Swarm Mode: Dynamic parallel execution limits
  private readonly BASE_MAX_PARALLEL = 3;
  private readonly SWARM_MAX_PARALLEL = 10;
  private readonly SWARM_ACTIVATION_THRESHOLD = 8;
  private swarmModeActive = false;

  constructor(
    @InjectRepository(Goal)
    private goalRepository: Repository<Goal>,
    @InjectRepository(Subtask)
    private subtaskRepository: Repository<Subtask>,
    private realTimeSessionService: RealTimeSessionService,
    private coachService: LLMCoachService,
    private priorityEngine: PriorityEngineService,
    private gateway: AutonomousGateway,
  ) {
    this.logger.log('🤖 Autonomous Orchestrator initialized (Phase 4 - FULL REALITY MODE)');
  }

  /**
   * Get current max parallel executions (dynamic based on queue depth)
   */
  private get maxParallelExecutions(): number {
    return this.swarmModeActive ? this.SWARM_MAX_PARALLEL : this.BASE_MAX_PARALLEL;
  }

  /**
   * Main orchestration loop - runs every 30 seconds
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async orchestrate() {
    if (this.isRunning) {
      this.logger.debug('⏭️  Orchestration already running, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      this.logger.debug('🔄 Starting orchestration cycle...');

      // Step 0: Check swarm mode activation
      await this.checkSwarmMode();

      // Step 1: Run auto-prioritization
      await this.autoPrioritize();

      // Step 2: Discover new work (active goals not in queue)
      await this.discoverNewWork();

      // Step 3: Process queued tasks with real DeepAgent spawning
      await this.processQueue();

      // Step 4: Monitor running executions
      await this.monitorExecutions();

      // Step 5: Clean up completed/failed tasks
      await this.cleanup();

      // Step 6: Broadcast status update
      await this.broadcastStatus();

      this.logger.debug('✅ Orchestration cycle complete');

    } catch (error) {
      this.logger.error(`❌ Orchestration error: ${error.message}`, error.stack);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check if swarm mode should be activated
   */
  private async checkSwarmMode() {
    const db = this.goalRepository.manager;

    const queueDepth = await db.query(`
      SELECT COUNT(*) as count FROM execution_queue
      WHERE status IN ('queued', 'processing')
    `);

    const depth = parseInt(queueDepth[0]?.count || '0');

    const shouldActivate = depth >= this.SWARM_ACTIVATION_THRESHOLD;

    if (shouldActivate && !this.swarmModeActive) {
      this.swarmModeActive = true;
      this.logger.warn(`🐝 SWARM MODE ACTIVATED - Queue depth: ${depth}, Max parallel: ${this.SWARM_MAX_PARALLEL}`);
      this.gateway.broadcastSwarmStatus(true, depth);
    } else if (!shouldActivate && this.swarmModeActive) {
      this.swarmModeActive = false;
      this.logger.log(`🐝 Swarm mode deactivated - Queue depth: ${depth}`);
      this.gateway.broadcastSwarmStatus(false, depth);
    }
  }

  /**
   * Auto-prioritize active goals periodically
   */
  private async autoPrioritize() {
    // Run every 10th cycle (~5 minutes)
    if (Math.random() < 0.1) {
      this.logger.debug('🎯 Running auto-prioritization...');
      await this.priorityEngine.reprioritizeAll();
    }
  }

  /**
   * Discover active goals that need execution
   */
  private async discoverNewWork() {
    const db = this.goalRepository.manager;

    // Find active goals not already in queue
    const activeGoals = await db.query(`
      SELECT g.* FROM goals g
      WHERE g.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM execution_queue eq
        WHERE eq.goal_id = g.id
        AND eq.status IN ('queued', 'processing')
      )
      LIMIT 10
    `);

    if (activeGoals.length > 0) {
      this.logger.log(`📋 Discovered ${activeGoals.length} new goals for execution`);

      for (const goal of activeGoals) {
        await this.queueGoal(goal.id, goal.priority);
      }
    }
  }

  /**
   * Queue a goal for execution with LLM coach analysis
   */
  async queueGoal(goalId: number, priority?: number) {
    const db = this.goalRepository.manager;

    // Get goal details
    const goal = await this.goalRepository.findOne({ where: { id: goalId } });
    if (!goal) {
      throw new Error(`Goal ${goalId} not found`);
    }

    // Get LLM coach analysis
    this.logger.log(`🧠 Running coach analysis for goal ${goalId}...`);
    const analysis = await this.coachService.analyzeGoal(goal.title, goal.description || '');

    // Use coach-suggested priority if not explicitly provided
    const finalPriority = priority !== undefined ? priority : analysis.suggested_priority;

    // Store analysis in metadata
    const metadata = {
      source: 'auto_discovery',
      coach_analysis: analysis,
      queued_by: 'orchestrator',
    };

    const result = await db.query(`
      INSERT INTO execution_queue (goal_id, priority, status, metadata)
      VALUES ($1, $2, 'queued', $3)
      RETURNING *
    `, [goalId, finalPriority, JSON.stringify(metadata)]);

    this.logger.log(
      `➕ Goal ${goalId} queued (priority: ${finalPriority}, feasibility: ${analysis.feasibility_score}%, effort: ${analysis.estimated_effort})`
    );

    await this.logExecution(
      result[0].id,
      goalId,
      'info',
      `Goal queued - ${analysis.recommended_approach}`,
      { analysis }
    );

    // Broadcast to frontend
    this.gateway.broadcastQueueUpdate(result[0]);

    return result[0];
  }

  /**
   * Process queued tasks - spawn real DeepAgent sessions
   */
  private async processQueue() {
    const db = this.goalRepository.manager;

    // Count current running executions
    const runningCount = await db.query(`
      SELECT COUNT(*) as count FROM execution_queue
      WHERE status = 'processing'
    `);

    const availableSlots = this.maxParallelExecutions - parseInt(runningCount[0].count);

    if (availableSlots <= 0) {
      this.logger.debug(
        `⏸️  Max parallel executions reached (${this.maxParallelExecutions}${this.swarmModeActive ? ' - SWARM MODE' : ''})`
      );
      return;
    }

    // Get next tasks from queue (priority order)
    const queuedTasks = await db.query(`
      SELECT * FROM execution_queue
      WHERE status = 'queued'
      AND attempts < max_attempts
      ORDER BY priority DESC, queued_at ASC
      LIMIT $1
    `, [availableSlots]);

    if (queuedTasks.length > 0) {
      this.logger.log(
        `🚀 Processing ${queuedTasks.length} queued tasks (${this.swarmModeActive ? 'SWARM MODE' : 'normal mode'})`
      );

      for (const task of queuedTasks) {
        await this.executeTask(task);
      }
    }
  }

  /**
   * Execute a task - spawn REAL DeepAgent session (Phase 4)
   */
  private async executeTask(task: ExecutionQueueItem) {
    const db = this.goalRepository.manager;

    try {
      this.logger.log(`▶️  Executing task ${task.id} (goal: ${task.goal_id})`);

      // Get goal details
      const goal = await this.goalRepository.findOne({ where: { id: task.goal_id } });

      if (!goal) {
        throw new Error(`Goal ${task.goal_id} not found`);
      }

      // Spawn REAL DeepAgent session
      this.logger.log(`🌱 Spawning DeepAgent session for: "${goal.title}"`);
      
      const session = await this.realTimeSessionService.spawnSession(
        goal.id,
        goal.title,
        goal.description || ''
      );

      // Update task with session info
      await db.query(`
        UPDATE execution_queue
        SET status = 'processing',
            attempts = attempts + 1,
            started_at = CURRENT_TIMESTAMP,
            assigned_agent = 'DeepAgent',
            session_id = $1,
            metadata = $2
        WHERE id = $3
      `, [
        session.session_id,
        JSON.stringify({ ...task.metadata, session: session }),
        task.id
      ]);

      await this.logExecution(
        task.id,
        task.goal_id,
        'info',
        `DeepAgent session spawned: ${session.session_id}`,
        { session_id: session.session_id }
      );

      // Broadcast real-time update
      this.gateway.broadcastExecutionStart(task.id, goal.id, session.session_id);

      this.logger.log(`✅ Session ${session.session_id} spawned for goal ${goal.id}`);

    } catch (error) {
      this.logger.error(`❌ Task ${task.id} execution failed: ${error.message}`);

      await db.query(`
        UPDATE execution_queue
        SET status = 'failed',
            error_message = $1,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [error.message, task.id]);

      await this.logExecution(task.id, task.goal_id, 'error', `Execution failed: ${error.message}`);

      // Broadcast failure
      this.gateway.broadcastExecutionError(task.id, task.goal_id, error.message);
    }
  }

  /**
   * Monitor running executions
   */
  private async monitorExecutions() {
    const db = this.goalRepository.manager;

    const runningTasks = await db.query(`
      SELECT * FROM execution_queue
      WHERE status = 'processing'
      AND started_at < NOW() - INTERVAL '5 minutes'
    `);

    if (runningTasks.length > 0) {
      this.logger.warn(`⚠️  Found ${runningTasks.length} tasks running >5min`);

      for (const task of runningTasks) {
        // TODO: Check actual session status
        // For now, just log a warning
        await this.logExecution(
          task.id,
          task.goal_id,
          'warning',
          'Task running longer than expected'
        );
      }
    }
  }

  /**
   * Clean up old completed/failed tasks
   */
  private async cleanup() {
    const db = this.goalRepository.manager;

    const result = await db.query(`
      DELETE FROM execution_queue
      WHERE status IN ('completed', 'failed')
      AND completed_at < NOW() - INTERVAL '7 days'
    `);

    if (result[1] > 0) {
      this.logger.log(`🧹 Cleaned up ${result[1]} old execution records`);
    }
  }

  /**
   * Log execution event
   */
  private async logExecution(
    queueId: number,
    goalId: number,
    level: string,
    message: string,
    details: any = {}
  ) {
    const db = this.goalRepository.manager;

    await db.query(`
      INSERT INTO execution_logs (queue_id, goal_id, log_level, message, details)
      VALUES ($1, $2, $3, $4, $5)
    `, [queueId, goalId, level, message, JSON.stringify(details)]);
  }

  /**
   * Broadcast status update to connected clients
   */
  private async broadcastStatus() {
    const status = await this.getQueueStatus();
    this.gateway.broadcastStatus(status);
  }

  /**
   * Get queue status (Phase 4 - enhanced)
   */
  async getQueueStatus() {
    const db = this.goalRepository.manager;

    const stats = await db.query(`
      SELECT
        status,
        COUNT(*) as count,
        AVG(priority) as avg_priority
      FROM execution_queue
      WHERE status IN ('queued', 'processing')
      GROUP BY status
    `);

    const total = await db.query(`
      SELECT COUNT(*) as count FROM execution_queue
      WHERE status IN ('queued', 'processing')
    `);

    const activeSessions = this.realTimeSessionService.getActiveSessions();

    return {
      total: parseInt(total[0]?.count || 0),
      by_status: stats,
      max_parallel: this.maxParallelExecutions,
      swarm_mode_active: this.swarmModeActive,
      swarm_threshold: this.SWARM_ACTIVATION_THRESHOLD,
      active_sessions: activeSessions.length,
      sessions: activeSessions,
    };
  }

  /**
   * Get execution logs for a goal
   */
  async getExecutionLogs(goalId: number, limit: number = 50) {
    const db = this.goalRepository.manager;

    return await db.query(`
      SELECT * FROM execution_logs
      WHERE goal_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `, [goalId, limit]);
  }
}
