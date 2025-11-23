
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal } from '../entities/goal.entity';
import { Subtask } from '../entities/subtask.entity';

/**
 * Autonomous Orchestrator Service - Phase 3
 * 
 * The brain of MIN's autonomous execution system.
 * Monitors goals, spawns DeepAgent sessions, manages parallel execution.
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
  private readonly MAX_PARALLEL_EXECUTIONS = 3;

  constructor(
    @InjectRepository(Goal)
    private goalRepository: Repository<Goal>,
    @InjectRepository(Subtask)
    private subtaskRepository: Repository<Subtask>,
  ) {
    this.logger.log('🤖 Autonomous Orchestrator initialized');
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

      // Step 1: Discover new work (active goals not in queue)
      await this.discoverNewWork();

      // Step 2: Process queued tasks
      await this.processQueue();

      // Step 3: Monitor running executions
      await this.monitorExecutions();

      // Step 4: Clean up completed/failed tasks
      await this.cleanup();

      this.logger.debug('✅ Orchestration cycle complete');

    } catch (error) {
      this.logger.error(`❌ Orchestration error: ${error.message}`, error.stack);
    } finally {
      this.isRunning = false;
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
   * Queue a goal for execution
   */
  async queueGoal(goalId: number, priority: number = 3) {
    const db = this.goalRepository.manager;

    const result = await db.query(`
      INSERT INTO execution_queue (goal_id, priority, status, metadata)
      VALUES ($1, $2, 'queued', $3)
      RETURNING *
    `, [goalId, priority, JSON.stringify({ source: 'auto_discovery' })]);

    this.logger.log(`➕ Goal ${goalId} added to execution queue (priority: ${priority})`);

    await this.logExecution(result[0].id, goalId, 'info', 'Goal queued for autonomous execution');

    return result[0];
  }

  /**
   * Process queued tasks - spawn DeepAgent sessions
   */
  private async processQueue() {
    const db = this.goalRepository.manager;

    // Count current running executions
    const runningCount = await db.query(`
      SELECT COUNT(*) as count FROM execution_queue
      WHERE status = 'processing'
    `);

    const availableSlots = this.MAX_PARALLEL_EXECUTIONS - parseInt(runningCount[0].count);

    if (availableSlots <= 0) {
      this.logger.debug(`⏸️  Max parallel executions reached (${this.MAX_PARALLEL_EXECUTIONS})`);
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
      this.logger.log(`🚀 Processing ${queuedTasks.length} queued tasks`);

      for (const task of queuedTasks) {
        await this.executeTask(task);
      }
    }
  }

  /**
   * Execute a task - spawn DeepAgent session
   */
  private async executeTask(task: ExecutionQueueItem) {
    const db = this.goalRepository.manager;

    try {
      this.logger.log(`▶️  Executing task ${task.id} (goal: ${task.goal_id})`);

      // Update task status
      await db.query(`
        UPDATE execution_queue
        SET status = 'processing',
            attempts = attempts + 1,
            started_at = CURRENT_TIMESTAMP,
            assigned_agent = $1
        WHERE id = $2
      `, ['MIN-ORCHESTRATOR', task.id]);

      await this.logExecution(task.id, task.goal_id, 'info', 'Task execution started');

      // Get goal details
      const goal = await this.goalRepository.findOne({ where: { id: task.goal_id } });

      if (!goal) {
        throw new Error(`Goal ${task.goal_id} not found`);
      }

      // TODO: Actually spawn DeepAgent session here
      // For now, we'll simulate execution
      this.logger.warn(`⚠️  DeepAgent integration not yet implemented - simulating execution`);

      // Simulate execution (remove this in production)
      await this.simulateExecution(task, goal);

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
    }
  }

  /**
   * Simulate execution (temporary - will be replaced with real DeepAgent integration)
   */
  private async simulateExecution(task: ExecutionQueueItem, goal: Goal) {
    const db = this.goalRepository.manager;

    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mark as completed
    await db.query(`
      UPDATE execution_queue
      SET status = 'completed',
          completed_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [task.id]);

    await this.logExecution(task.id, task.goal_id, 'success', 'Task completed successfully (simulated)');

    this.logger.log(`✅ Task ${task.id} completed (simulated)`);
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
   * Get queue status
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

    return {
      total: parseInt(total[0]?.count || 0),
      by_status: stats,
      max_parallel: this.MAX_PARALLEL_EXECUTIONS,
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
