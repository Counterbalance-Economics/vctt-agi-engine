
/**
 * SchedulerService - Constrained Autonomous Task Scheduling
 * 
 * STAGE 4: Enables MIN to schedule its own tasks while maintaining human control.
 * 
 * Features:
 * - Deferred tasks: "Run tests in 10 minutes"
 * - Periodic tasks: "Re-index every night at 3 AM"
 * - Reminder tasks: "Follow up tomorrow"
 * - All tasks MUST be linked to approved goals
 * - Full audit trail
 * - Approval workflows for sensitive operations
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from './prisma.service';
import { SafetyStewardAgent } from '../agents/safety-steward.agent';

export interface ScheduleTaskDto {
  title: string;
  description?: string;
  task_type: 'deferred' | 'periodic' | 'reminder';
  scheduled_at?: Date; // For deferred/reminder
  cron_expression?: string; // For periodic
  timezone?: string;
  priority?: number; // 1-5
  tool_name: string;
  tool_params: any;
  goal_id: number; // REQUIRED - must link to approved goal
  created_by: string;
  requires_approval?: boolean;
}

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly safetySteward: SafetyStewardAgent,
  ) {}

  /**
   * Schedule a new task
   */
  async scheduleTask(dto: ScheduleTaskDto): Promise<any> {
    this.logger.log(`📅 Scheduling task: ${dto.title} (${dto.task_type})`);

    // Validate goal exists and is approved
    const goal = await this.prisma.goals.findUnique({
      where: { id: dto.goal_id },
    });

    if (!goal) {
      throw new Error(`Goal #${dto.goal_id} not found`);
    }

    if (goal.status !== 'active') {
      throw new Error(`Goal #${dto.goal_id} is not active (status: ${goal.status})`);
    }

    // Validate task type and scheduling
    if (dto.task_type === 'periodic' && !dto.cron_expression) {
      throw new Error('Periodic tasks require cron_expression');
    }

    if ((dto.task_type === 'deferred' || dto.task_type === 'reminder') && !dto.scheduled_at) {
      throw new Error('Deferred/reminder tasks require scheduled_at');
    }

    // Validate tool exists in registry
    const tool = await this.prisma.tool_registry.findUnique({
      where: { tool_name: dto.tool_name },
    });

    if (!tool) {
      throw new Error(`Tool '${dto.tool_name}' not found in registry`);
    }

    // Check if tool requires approval
    const requiresApproval = dto.requires_approval !== undefined 
      ? dto.requires_approval 
      : tool.requires_approval;

    // Get current regulation mode
    const mode = await this.safetySteward.getMode();

    // Block task scheduling in RESEARCH mode
    if (mode === 'RESEARCH') {
      throw new Error('Task scheduling blocked: RESEARCH mode (read-only)');
    }

    // Create the scheduled task
    const task = await this.prisma.scheduled_tasks.create({
      data: {
        title: dto.title,
        description: dto.description,
        task_type: dto.task_type,
        scheduled_at: dto.scheduled_at || new Date(Date.now() + 3600000), // Default: 1 hour from now
        cron_expression: dto.cron_expression,
        timezone: dto.timezone || 'UTC',
        priority: dto.priority || 3,
        tool_name: dto.tool_name,
        tool_params: dto.tool_params,
        goal_id: dto.goal_id,
        created_by: dto.created_by,
        requires_approval: requiresApproval,
        status: requiresApproval ? 'pending' : 'pending', // Will stay pending until approved or scheduled
      },
    });

    // Audit this scheduling action
    await this.prisma.autonomy_audit.create({
      data: {
        event_type: 'task_scheduled',
        actor: dto.created_by,
        regulation_mode: mode,
        goal_id: dto.goal_id,
        task_id: task.id,
        details: {
          task_title: dto.title,
          task_type: dto.task_type,
          tool_name: dto.tool_name,
          scheduled_at: dto.scheduled_at?.toISOString(),
          cron_expression: dto.cron_expression,
        },
        risk_level: requiresApproval ? 'high' : 'low',
        outcome: requiresApproval ? 'pending_approval' : 'allowed',
      },
    });

    this.logger.log(`✅ Task scheduled: #${task.id} "${task.title}"`);

    if (requiresApproval) {
      this.logger.log(`   ⚠️  Requires human approval before execution`);
    }

    return {
      success: true,
      task,
      requiresApproval,
      message: requiresApproval 
        ? 'Task scheduled but requires human approval before execution'
        : 'Task scheduled successfully',
    };
  }

  /**
   * Approve a task (human only)
   */
  async approveTask(taskId: number, approvedBy: string): Promise<any> {
    const task = await this.prisma.scheduled_tasks.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task #${taskId} not found`);
    }

    if (!task.requires_approval) {
      throw new Error(`Task #${taskId} does not require approval`);
    }

    if (task.approved_by) {
      throw new Error(`Task #${taskId} already approved by ${task.approved_by}`);
    }

    const updated = await this.prisma.scheduled_tasks.update({
      where: { id: taskId },
      data: {
        approved_by: approvedBy,
        approved_at: new Date(),
      },
    });

    // Audit approval
    await this.prisma.autonomy_audit.create({
      data: {
        event_type: 'approval_requested',
        actor: approvedBy,
        regulation_mode: await this.safetySteward.getMode(),
        task_id: taskId,
        details: {
          action: 'approved',
          task_title: task.title,
          task_type: task.task_type,
        },
        risk_level: 'high',
        outcome: 'approved',
      },
    });

    this.logger.log(`✅ Task #${taskId} approved by ${approvedBy}`);

    return { success: true, task: updated };
  }

  /**
   * Cancel a scheduled task
   */
  async cancelTask(taskId: number, cancelledBy: string): Promise<any> {
    const task = await this.prisma.scheduled_tasks.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task #${taskId} not found`);
    }

    if (task.status === 'completed') {
      throw new Error(`Cannot cancel completed task #${taskId}`);
    }

    if (task.status === 'running') {
      throw new Error(`Cannot cancel running task #${taskId} (wait for completion or use kill switch)`);
    }

    const updated = await this.prisma.scheduled_tasks.update({
      where: { id: taskId },
      data: {
        status: 'cancelled',
      },
    });

    // Audit cancellation
    await this.prisma.autonomy_audit.create({
      data: {
        event_type: 'task_executed',
        actor: cancelledBy,
        regulation_mode: await this.safetySteward.getMode(),
        task_id: taskId,
        details: {
          action: 'cancelled',
          task_title: task.title,
        },
        risk_level: 'low',
        outcome: 'blocked',
        block_reason: `Cancelled by ${cancelledBy}`,
      },
    });

    this.logger.log(`🚫 Task #${taskId} cancelled by ${cancelledBy}`);

    return { success: true, task: updated };
  }

  /**
   * Get pending tasks (for human review)
   */
  async getPendingTasks(): Promise<any> {
    const tasks = await this.prisma.scheduled_tasks.findMany({
      where: {
        status: 'pending',
        requires_approval: true,
        approved_by: null,
      },
      include: {
        goal: true,
      },
      orderBy: [
        { priority: 'desc' },
        { created_at: 'asc' },
      ],
    });

    return {
      success: true,
      count: tasks.length,
      tasks,
    };
  }

  /**
   * Get all scheduled tasks for a goal
   */
  async getTasksForGoal(goalId: number): Promise<any> {
    const tasks = await this.prisma.scheduled_tasks.findMany({
      where: { goal_id: goalId },
      orderBy: [
        { scheduled_at: 'asc' },
      ],
    });

    return {
      success: true,
      count: tasks.length,
      tasks,
    };
  }

  /**
   * Execute a scheduled task (internal - called by scheduler)
   */
  private async executeTask(taskId: number): Promise<void> {
    const task = await this.prisma.scheduled_tasks.findUnique({
      where: { id: taskId },
      include: { goal: true },
    });

    if (!task) {
      this.logger.error(`Task #${taskId} not found`);
      return;
    }

    if (task.status !== 'pending') {
      this.logger.warn(`Task #${taskId} is not pending (status: ${task.status})`);
      return;
    }

    if (task.requires_approval && !task.approved_by) {
      this.logger.warn(`Task #${taskId} requires approval but not yet approved`);
      return;
    }

    // Check if goal is still active
    if (task.goal && task.goal.status !== 'active') {
      this.logger.warn(`Task #${taskId} goal is no longer active, cancelling task`);
      await this.prisma.scheduled_tasks.update({
        where: { id: taskId },
        data: { status: 'cancelled', error: 'Goal no longer active' },
      });
      return;
    }

    // Mark as running
    await this.prisma.scheduled_tasks.update({
      where: { id: taskId },
      data: {
        status: 'running',
        started_at: new Date(),
      },
    });

    this.logger.log(`🚀 Executing task #${taskId}: ${task.title}`);

    try {
      // Execute the tool (this will be implemented when we build the tool orchestration)
      const result = await this.invokeToolForTask(task);

      // Mark as completed
      await this.prisma.scheduled_tasks.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          completed_at: new Date(),
          result,
        },
      });

      // Audit execution
      await this.prisma.autonomy_audit.create({
        data: {
          event_type: 'task_executed',
          actor: 'min',
          regulation_mode: await this.safetySteward.getMode(),
          goal_id: task.goal_id,
          task_id: taskId,
          details: {
            task_title: task.title,
            tool_name: task.tool_name,
            success: true,
          },
          risk_level: 'medium',
          outcome: 'allowed',
        },
      });

      this.logger.log(`✅ Task #${taskId} completed successfully`);

      // If this is a periodic task, schedule the next execution
      if (task.task_type === 'periodic' && task.cron_expression) {
        // This will be handled by the cron scheduler itself
        this.logger.log(`   📅 Periodic task will run again: ${task.cron_expression}`);
      }
    } catch (error) {
      this.logger.error(`❌ Task #${taskId} failed: ${error.message}`);

      // Increment retry count
      const newRetryCount = task.retry_count + 1;

      if (newRetryCount >= task.max_retries) {
        // Max retries reached, mark as failed
        await this.prisma.scheduled_tasks.update({
          where: { id: taskId },
          data: {
            status: 'failed',
            retry_count: newRetryCount,
            error: error.message,
            completed_at: new Date(),
          },
        });

        this.logger.error(`   ❌ Max retries (${task.max_retries}) reached, task failed permanently`);
      } else {
        // Retry
        await this.prisma.scheduled_tasks.update({
          where: { id: taskId },
          data: {
            status: 'pending',
            retry_count: newRetryCount,
            error: error.message,
            scheduled_at: new Date(Date.now() + 60000 * Math.pow(2, newRetryCount)), // Exponential backoff
          },
        });

        this.logger.warn(`   🔄 Retry ${newRetryCount}/${task.max_retries} scheduled`);
      }

      // Audit failure
      await this.prisma.autonomy_audit.create({
        data: {
          event_type: 'task_executed',
          actor: 'min',
          regulation_mode: await this.safetySteward.getMode(),
          goal_id: task.goal_id,
          task_id: taskId,
          details: {
            task_title: task.title,
            tool_name: task.tool_name,
            success: false,
            error: error.message,
            retry_count: newRetryCount,
          },
          risk_level: 'medium',
          outcome: 'blocked',
          block_reason: error.message,
        },
      });
    }
  }

  /**
   * Invoke a tool for a scheduled task (placeholder - will be implemented with tool orchestration)
   */
  private async invokeToolForTask(task: any): Promise<any> {
    this.logger.log(`   🔧 Invoking tool: ${task.tool_name}`);

    // This is a placeholder - actual tool invocation will be implemented
    // in Phase 3 (Tool Orchestration)
    
    // For now, just log and return a mock result
    return {
      tool: task.tool_name,
      params: task.tool_params,
      result: 'Tool invocation pending - Phase 3',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Cron job: Run every minute to check for due tasks
   */
  @Cron('*/1 * * * *') // Every minute
  async checkScheduledTasks() {
    try {
      const now = new Date();

      // Find all pending tasks that are due
      const dueTasks = await this.prisma.scheduled_tasks.findMany({
        where: {
          status: 'pending',
          scheduled_at: {
            lte: now,
          },
          OR: [
            { requires_approval: false },
            { AND: [{ requires_approval: true }, { approved_by: { not: null } }] },
          ],
        },
        orderBy: [
          { priority: 'desc' },
          { scheduled_at: 'asc' },
        ],
        take: 10, // Process max 10 tasks per minute
      });

      if (dueTasks.length > 0) {
        this.logger.log(`⏰ Found ${dueTasks.length} due task(s)`);

        for (const task of dueTasks) {
          await this.executeTask(task.id);
        }
      }
    } catch (error) {
      this.logger.error(`Scheduler error: ${error.message}`);
    }
  }

  /**
   * Get task status
   */
  async getTaskStatus(taskId: number): Promise<any> {
    const task = await this.prisma.scheduled_tasks.findUnique({
      where: { id: taskId },
      include: {
        goal: true,
      },
    });

    if (!task) {
      throw new Error(`Task #${taskId} not found`);
    }

    return {
      success: true,
      task,
    };
  }
}
