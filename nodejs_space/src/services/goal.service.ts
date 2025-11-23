
import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SafetyStewardAgent } from '../agents/safety-steward.agent';

export interface CreateGoalDto {
  title: string;
  description?: string;
  priority?: number; // 1-5
  owner: 'human' | 'system' | 'min';
  parentGoalId?: number;
  createdBy: string;
  metadata?: any;
}

export interface UpdateGoalDto {
  title?: string;
  description?: string;
  status?: 'proposed' | 'active' | 'paused' | 'completed' | 'abandoned';
  priority?: number;
  metadata?: any;
}

export interface AddProgressDto {
  progressPercent: number;
  milestone?: string;
  notes?: string;
  recordedBy: string;
}

@Injectable()
export class GoalService {
  private readonly logger = new Logger(GoalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly safetySteward: SafetyStewardAgent,
  ) {
    this.logger.log('🎯 Goal Service initialized');
  }

  /**
   * Create a new goal
   */
  async createGoal(dto: CreateGoalDto): Promise<any> {
    // Safety check
    const safetyCheck = await this.safetySteward.checkOperation('WRITE', {
      intent: 'Create goal',
      data: dto,
    });

    if (!safetyCheck.allowed) {
      this.logger.warn(`Goal creation blocked: ${safetyCheck.reason}`);
      throw new HttpException(
        `Goal creation blocked: ${safetyCheck.reason}`,
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      // Create goal
      const goal = await this.prisma.goals.create({
        data: {
          title: dto.title,
          description: dto.description,
          priority: dto.priority || 3,
          owner: dto.owner,
          parent_goal_id: dto.parentGoalId,
          created_by: dto.createdBy,
          metadata: dto.metadata || {},
        },
      });

      // Audit trail
      const currentMode = this.safetySteward.getMode();
      await this.prisma.goal_audit.create({
        data: {
          goal_id: goal.id,
          action: 'created',
          actor: dto.createdBy,
          reason: `Goal created: ${dto.title}`,
          after_state: goal,
          regulation_mode: currentMode,
        },
      });

      this.logger.log(`✅ Goal created: ${goal.id} - ${goal.title}`);
      return goal;
    } catch (error) {
      this.logger.error('Error creating goal:', error);
      throw new HttpException(
        'Failed to create goal',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get all goals (with optional filtering)
   */
  async getGoals(filters?: {
    status?: string;
    owner?: string;
    priority?: number;
  }): Promise<any[]> {
    try {
      const where: any = {};
      
      if (filters?.status) where.status = filters.status;
      if (filters?.owner) where.owner = filters.owner;
      if (filters?.priority) where.priority = filters.priority;

      const goals = await this.prisma.goals.findMany({
        where,
        include: {
          child_goals: true,
          constraints: true,
          progress_entries: {
            orderBy: { recorded_at: 'desc' },
            take: 1,
          },
        },
        orderBy: [
          { priority: 'desc' },
          { created_at: 'desc' },
        ],
      });

      return goals;
    } catch (error) {
      this.logger.error('Error fetching goals:', error);
      throw new HttpException(
        'Failed to fetch goals',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get active goals
   */
  async getActiveGoals(): Promise<any[]> {
    return this.getGoals({ status: 'active' });
  }

  /**
   * Get a single goal by ID
   */
  async getGoal(id: number): Promise<any> {
    try {
      const goal = await this.prisma.goals.findUnique({
        where: { id },
        include: {
          parent_goal: true,
          child_goals: true,
          constraints: true,
          progress_entries: {
            orderBy: { recorded_at: 'desc' },
          },
          audit_entries: {
            orderBy: { timestamp: 'desc' },
            take: 10,
          },
        },
      });

      if (!goal) {
        throw new HttpException('Goal not found', HttpStatus.NOT_FOUND);
      }

      return goal;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Error fetching goal:', error);
      throw new HttpException(
        'Failed to fetch goal',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update a goal
   */
  async updateGoal(id: number, dto: UpdateGoalDto, updatedBy: string): Promise<any> {
    // Safety check
    const safetyCheck = await this.safetySteward.checkOperation('WRITE', {
      intent: 'Update goal',
      data: dto,
    });

    if (!safetyCheck.allowed) {
      this.logger.warn(`Goal update blocked: ${safetyCheck.reason}`);
      throw new HttpException(
        `Goal update blocked: ${safetyCheck.reason}`,
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      // Get current state for audit
      const currentGoal = await this.prisma.goals.findUnique({
        where: { id },
      });

      if (!currentGoal) {
        throw new HttpException('Goal not found', HttpStatus.NOT_FOUND);
      }

      // Update goal
      const updatedGoal = await this.prisma.goals.update({
        where: { id },
        data: {
          ...dto,
          completed_at: dto.status === 'completed' ? new Date() : currentGoal.completed_at,
        },
      });

      // Audit trail
      const currentMode = this.safetySteward.getMode();
      await this.prisma.goal_audit.create({
        data: {
          goal_id: id,
          action: 'updated',
          actor: updatedBy,
          before_state: currentGoal,
          after_state: updatedGoal,
          regulation_mode: currentMode,
        },
      });

      this.logger.log(`✅ Goal updated: ${id}`);
      return updatedGoal;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Error updating goal:', error);
      throw new HttpException(
        'Failed to update goal',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Change goal status (activate, pause, complete, abandon)
   */
  async changeStatus(
    id: number,
    status: 'proposed' | 'active' | 'paused' | 'completed' | 'abandoned',
    actor: string,
    reason?: string,
  ): Promise<any> {
    return this.updateGoal(id, { status }, actor);
  }

  /**
   * Add progress update to a goal
   */
  async addProgress(id: number, dto: AddProgressDto): Promise<any> {
    // Safety check
    const safetyCheck = await this.safetySteward.checkOperation('WRITE', {
      intent: 'Add goal progress',
      data: dto,
    });

    if (!safetyCheck.allowed) {
      this.logger.warn(`Progress update blocked: ${safetyCheck.reason}`);
      throw new HttpException(
        `Progress update blocked: ${safetyCheck.reason}`,
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      // Verify goal exists
      const goal = await this.prisma.goals.findUnique({
        where: { id },
      });

      if (!goal) {
        throw new HttpException('Goal not found', HttpStatus.NOT_FOUND);
      }

      // Add progress entry
      const progress = await this.prisma.goal_progress.create({
        data: {
          goal_id: id,
          progress_percent: dto.progressPercent,
          milestone: dto.milestone,
          notes: dto.notes,
          recorded_by: dto.recordedBy,
        },
      });

      // If progress is 100%, auto-complete the goal
      if (dto.progressPercent === 100 && goal.status !== 'completed') {
        await this.updateGoal(id, { status: 'completed' }, dto.recordedBy);
      }

      this.logger.log(`✅ Progress added to goal ${id}: ${dto.progressPercent}%`);
      return progress;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Error adding progress:', error);
      throw new HttpException(
        'Failed to add progress',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete a goal
   */
  async deleteGoal(id: number, deletedBy: string): Promise<void> {
    // Safety check
    const safetyCheck = await this.safetySteward.checkOperation('WRITE', {
      intent: 'Delete goal',
      data: { id },
    });

    if (!safetyCheck.allowed) {
      this.logger.warn(`Goal deletion blocked: ${safetyCheck.reason}`);
      throw new HttpException(
        `Goal deletion blocked: ${safetyCheck.reason}`,
        HttpStatus.FORBIDDEN,
      );
    }

    try {
      // Get current state for audit
      const goal = await this.prisma.goals.findUnique({
        where: { id },
      });

      if (!goal) {
        throw new HttpException('Goal not found', HttpStatus.NOT_FOUND);
      }

      // Delete goal (cascades to constraints, progress, audit)
      await this.prisma.goals.delete({
        where: { id },
      });

      this.logger.log(`✅ Goal deleted: ${id}`);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Error deleting goal:', error);
      throw new HttpException(
        'Failed to delete goal',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get goal hierarchy tree
   */
  async getGoalTree(): Promise<any[]> {
    try {
      // Get root goals (no parent)
      const rootGoals = await this.prisma.goals.findMany({
        where: { parent_goal_id: null },
        include: {
          child_goals: {
            include: {
              child_goals: true,
              progress_entries: {
                orderBy: { recorded_at: 'desc' },
                take: 1,
              },
            },
          },
          progress_entries: {
            orderBy: { recorded_at: 'desc' },
            take: 1,
          },
        },
        orderBy: [
          { priority: 'desc' },
          { created_at: 'desc' },
        ],
      });

      return rootGoals;
    } catch (error) {
      this.logger.error('Error fetching goal tree:', error);
      throw new HttpException(
        'Failed to fetch goal tree',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get activity log for a goal
   */
  async getActivity(goalId: number, limit: number = 50): Promise<any[]> {
    try {
      // Check goal exists
      const goal = await this.prisma.goals.findUnique({
        where: { id: goalId },
      });

      if (!goal) {
        throw new HttpException('Goal not found', HttpStatus.NOT_FOUND);
      }

      const activity = await this.prisma.goal_activity_logs.findMany({
        where: { goal_id: goalId },
        orderBy: { created_at: 'desc' },
        take: limit,
      });

      return activity;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Error fetching activity:', error);
      throw new HttpException(
        'Failed to fetch activity',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Log activity for a goal
   */
  async logActivity(
    goalId: number,
    actor: string,
    activityType: string,
    message: string,
    metadata?: any
  ): Promise<any> {
    try {
      // Check goal exists
      const goal = await this.prisma.goals.findUnique({
        where: { id: goalId },
      });

      if (!goal) {
        throw new HttpException('Goal not found', HttpStatus.NOT_FOUND);
      }

      const activity = await this.prisma.goal_activity_logs.create({
        data: {
          goal_id: goalId,
          actor,
          activity_type: activityType,
          message,
          metadata: metadata || {},
        },
      });

      this.logger.log(`📝 Activity logged for goal ${goalId}: ${activityType}`);
      return activity;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Error logging activity:', error);
      throw new HttpException(
        'Failed to log activity',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get subtasks for a goal
   */
  async getSubtasks(goalId: number): Promise<any[]> {
    try {
      // Check goal exists
      const goal = await this.prisma.goals.findUnique({
        where: { id: goalId },
      });

      if (!goal) {
        throw new HttpException('Goal not found', HttpStatus.NOT_FOUND);
      }

      const subtasks = await this.prisma.goal_subtasks.findMany({
        where: { goal_id: goalId },
        orderBy: { order_index: 'asc' },
      });

      return subtasks;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Error fetching subtasks:', error);
      throw new HttpException(
        'Failed to fetch subtasks',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create subtasks for a goal
   */
  async createSubtasks(
    goalId: number,
    subtasksData: Array<{ title: string; description?: string; estimatedEffort?: string }>
  ): Promise<any[]> {
    try {
      // Check goal exists
      const goal = await this.prisma.goals.findUnique({
        where: { id: goalId },
      });

      if (!goal) {
        throw new HttpException('Goal not found', HttpStatus.NOT_FOUND);
      }

      // Create subtasks
      const createdSubtasks = [];
      for (let i = 0; i < subtasksData.length; i++) {
        const subtaskData = subtasksData[i];
        const subtask = await this.prisma.goal_subtasks.create({
          data: {
            goal_id: goalId,
            title: subtaskData.title,
            description: subtaskData.description,
            estimated_effort: subtaskData.estimatedEffort || 'medium',
            order_index: i,
            status: 'pending',
            created_by: 'human',
          },
        });
        createdSubtasks.push(subtask);
      }

      // Log activity
      await this.logActivity(
        goalId,
        'human',
        'subtask_created',
        `Created ${createdSubtasks.length} subtasks manually`,
        { subtasks: createdSubtasks.map(st => st.title) }
      );

      this.logger.log(`✅ Created ${createdSubtasks.length} subtasks for goal ${goalId}`);
      return createdSubtasks;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Error creating subtasks:', error);
      throw new HttpException(
        'Failed to create subtasks',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
