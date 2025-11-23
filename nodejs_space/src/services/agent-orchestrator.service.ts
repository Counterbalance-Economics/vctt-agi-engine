
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { LLMService } from './llm.service';
import { GoalService } from './goal.service';

/**
 * Agent Orchestrator Service
 * 
 * Makes MIN autonomously work on goals by:
 * - Polling for high-priority active goals
 * - Decomposing goals into subtasks using LLM
 * - Executing subtasks one at a time
 * - Logging activity in real-time
 * - Updating goal progress
 */
@Injectable()
export class AgentOrchestratorService {
  private readonly logger = new Logger(AgentOrchestratorService.name);
  private executionInterval: NodeJS.Timeout | null = null;
  private isExecuting = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LLMService,
    private readonly goalService: GoalService,
  ) {
    this.logger.log('🤖 Agent Orchestrator Service initialized');
  }

  /**
   * Start the autonomous execution loop
   */
  async startExecution(): Promise<void> {
    this.logger.log('▶️ Starting autonomous execution...');

    // Check if already running
    const state = await this.getExecutionState();
    if (state?.is_running) {
      this.logger.warn('Execution is already running');
      return;
    }

    // Initialize execution state
    await this.updateExecutionState({
      is_running: true,
      started_at: new Date(),
      stopped_at: null,
      last_heartbeat: new Date(),
      error_message: null,
    });

    // Start the polling loop (every 2 minutes)
    this.executionInterval = setInterval(async () => {
      await this.executionCycle();
    }, 120000); // 2 minutes

    // Run first cycle immediately
    await this.executionCycle();

    this.logger.log('✅ Autonomous execution started');
  }

  /**
   * Stop the autonomous execution loop
   */
  async stopExecution(): Promise<void> {
    this.logger.log('⏸️ Stopping autonomous execution...');

    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }

    await this.updateExecutionState({
      is_running: false,
      stopped_at: new Date(),
      current_goal_id: null,
    });

    this.logger.log('✅ Autonomous execution stopped');
  }

  /**
   * Get current execution status
   */
  async getExecutionStatus(): Promise<any> {
    const state = await this.getExecutionState();
    
    let currentGoal = null;
    if (state?.current_goal_id) {
      currentGoal = await this.prisma.goals.findUnique({
        where: { id: state.current_goal_id },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
        },
      });
    }

    return {
      isRunning: state?.is_running || false,
      currentGoal,
      startedAt: state?.started_at,
      lastHeartbeat: state?.last_heartbeat,
      totalGoalsProcessed: state?.total_goals_processed || 0,
      totalSubtasksCompleted: state?.total_subtasks_completed || 0,
      errorMessage: state?.error_message,
    };
  }

  /**
   * Main execution cycle
   */
  private async executionCycle(): Promise<void> {
    // Prevent concurrent execution
    if (this.isExecuting) {
      this.logger.debug('Previous cycle still executing, skipping...');
      return;
    }

    this.isExecuting = true;

    try {
      // Update heartbeat
      await this.updateExecutionState({
        last_heartbeat: new Date(),
      });

      // Find highest priority active goal
      const goal = await this.findNextGoal();
      
      if (!goal) {
        this.logger.debug('No active goals to work on');
        await this.updateExecutionState({ current_goal_id: null });
        this.isExecuting = false;
        return;
      }

      this.logger.log(`🎯 Working on goal: ${goal.title}`);
      
      await this.updateExecutionState({ current_goal_id: goal.id });

      // Log activity
      await this.logActivity(goal.id, 'min', 'started', 'MIN is now working on this goal');

      // Check if subtasks exist, if not, decompose the goal
      let subtasks = await this.getSubtasks(goal.id);
      
      if (subtasks.length === 0) {
        this.logger.log('Decomposing goal into subtasks...');
        subtasks = await this.decomposeGoal(goal);
      }

      // Find next pending subtask
      const nextSubtask = subtasks.find(st => st.status === 'pending' || st.status === 'in_progress');
      
      if (nextSubtask) {
        this.logger.log(`📋 Executing subtask: ${nextSubtask.title}`);
        await this.executeSubtask(goal, nextSubtask);
      } else {
        // All subtasks completed - mark goal as complete
        this.logger.log('✅ All subtasks completed, marking goal as completed');
        await this.completeGoal(goal.id);
      }

      // Update goal progress
      const completedSubtasks = subtasks.filter(st => st.status === 'completed').length;
      const progressPercent = Math.round((completedSubtasks / subtasks.length) * 100);
      
      await this.goalService.addProgress(goal.id, {
        progressPercent,
        notes: `Completed ${completedSubtasks}/${subtasks.length} subtasks`,
        recordedBy: 'min',
      });

      // Increment stats
      const state = await this.getExecutionState();
      await this.updateExecutionState({
        total_goals_processed: (state?.total_goals_processed || 0) + 1,
      });

    } catch (error) {
      this.logger.error('Error in execution cycle:', error);
      await this.updateExecutionState({
        error_message: error.message,
      });
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Find the next goal to work on (highest priority active goal)
   */
  private async findNextGoal() {
    return this.prisma.goals.findFirst({
      where: {
        status: 'active',
      },
      orderBy: [
        { priority: 'desc' },
        { created_at: 'asc' },
      ],
    });
  }

  /**
   * Decompose a goal into subtasks using LLM
   */
  private async decomposeGoal(goal: any): Promise<any[]> {
    this.logger.log(`🧠 Using LLM to decompose goal: ${goal.title}`);

    const prompt = `You are MIN, an autonomous AGI agent in the VCTT-AGI system. You are authorized to generate code, analyze systems, create documentation, and perform any technical tasks needed to accomplish goals.

Goal: ${goal.title}
Description: ${goal.description || 'No description provided'}

Break this goal into 3-7 concrete, actionable subtasks. You are ALLOWED and EXPECTED to:
- Generate code snippets, components, or full implementations
- Analyze existing code and propose improvements
- Create technical documentation
- Design system architectures
- Perform any legitimate software engineering work

Provide a JSON array of subtasks with this structure:
[
  {
    "title": "Subtask title (concise, actionable)",
    "description": "Brief description of what needs to be done",
    "estimated_effort": "low" | "medium" | "high"
  }
]

Keep subtasks specific, measurable, and achievable. Focus on what can be done autonomously.`;

    try {
      const response = await this.llm.generateCompletion(
        [{ role: 'user', content: prompt }],
        'You are MIN, an autonomous AGI agent in VCTT-AGI. You are authorized to generate code, analyze systems, and perform any legitimate technical work to accomplish goals. Code generation and technical analysis are expected and encouraged.',
        0.7,
      );

      // Parse LLM response
      const subtasksData = this.extractJSON(response.content);
      
      if (!Array.isArray(subtasksData)) {
        throw new Error('LLM did not return a valid array');
      }

      // Create subtasks in database
      const createdSubtasks = [];
      for (let i = 0; i < subtasksData.length; i++) {
        const subtask = subtasksData[i];
        const created = await this.prisma.goal_subtasks.create({
          data: {
            goal_id: goal.id,
            title: subtask.title,
            description: subtask.description,
            estimated_effort: subtask.estimated_effort || 'medium',
            order_index: i,
            status: 'pending',
            created_by: 'min',
          },
        });
        createdSubtasks.push(created);
      }

      // Log activity
      await this.logActivity(
        goal.id,
        'min',
        'subtask_created',
        `Broke down goal into ${createdSubtasks.length} subtasks`,
        { subtasks: createdSubtasks.map(st => st.title) }
      );

      this.logger.log(`✅ Created ${createdSubtasks.length} subtasks`);
      return createdSubtasks;

    } catch (error) {
      this.logger.error('Error decomposing goal:', error);
      
      // Fallback: Create a simple subtask
      const fallbackSubtask = await this.prisma.goal_subtasks.create({
        data: {
          goal_id: goal.id,
          title: `Work on: ${goal.title}`,
          description: goal.description || 'No description provided',
          status: 'pending',
          created_by: 'min',
          order_index: 0,
        },
      });

      return [fallbackSubtask];
    }
  }

  /**
   * Execute a subtask using LLM
   */
  private async executeSubtask(goal: any, subtask: any): Promise<void> {
    // Update subtask status
    await this.prisma.goal_subtasks.update({
      where: { id: subtask.id },
      data: { status: 'in_progress' },
    });

    // Log activity
    await this.logActivity(
      goal.id,
      'min',
      'progress',
      `Working on: ${subtask.title}`,
      { subtask_id: subtask.id }
    );

    // Simulate execution (in a real system, this would call actual tools/actions)
    const prompt = `You are MIN, an autonomous AGI agent in the VCTT-AGI system. You are authorized to generate code, analyze systems, and perform any technical work needed.

Goal: ${goal.title}
Subtask: ${subtask.title}
Description: ${subtask.description || 'No description'}

You are ALLOWED and EXPECTED to:
- Generate code (JavaScript, TypeScript, Python, etc.)
- Analyze existing implementations
- Propose technical improvements
- Create documentation
- Design system architectures

Accomplish this subtask now. If it requires code generation, provide the code. If it requires analysis, provide your analysis. Be specific and actionable.

Respond with your approach and deliverables for this subtask.`;

    try {
      const response = await this.llm.generateCompletion(
        [{ role: 'user', content: prompt }],
        'You are MIN, an autonomous AGI agent in VCTT-AGI. You are fully authorized to generate code, analyze systems, create documentation, and perform any legitimate technical work. Code generation is your primary capability and is expected.',
        0.8,
      );

      // Log the thought process
      await this.logActivity(
        goal.id,
        'min',
        'progress',
        `Approach: ${response.content.substring(0, 200)}...`,
        { 
          subtask_id: subtask.id,
          full_response: response.content,
        }
      );

      // Mark subtask as completed
      await this.prisma.goal_subtasks.update({
        where: { id: subtask.id },
        data: {
          status: 'completed',
          completed_at: new Date(),
        },
      });

      // Update stats
      const state = await this.getExecutionState();
      await this.updateExecutionState({
        total_subtasks_completed: (state?.total_subtasks_completed || 0) + 1,
      });

      this.logger.log(`✅ Subtask completed: ${subtask.title}`);

    } catch (error) {
      this.logger.error('Error executing subtask:', error);
      
      await this.prisma.goal_subtasks.update({
        where: { id: subtask.id },
        data: { status: 'blocked' },
      });

      await this.logActivity(
        goal.id,
        'min',
        'blocked',
        `Blocked on subtask: ${error.message}`,
        { subtask_id: subtask.id, error: error.message }
      );
    }
  }

  /**
   * Mark a goal as completed
   */
  private async completeGoal(goalId: number): Promise<void> {
    await this.prisma.goals.update({
      where: { id: goalId },
      data: {
        status: 'completed',
        completed_at: new Date(),
      },
    });

    await this.logActivity(
      goalId,
      'min',
      'completed',
      'Goal completed! All subtasks finished.'
    );

    // Record in audit log
    await this.prisma.goal_audit.create({
      data: {
        goal_id: goalId,
        action: 'completed',
        actor: 'min',
        reason: 'All subtasks completed by autonomous execution',
        timestamp: new Date(),
      },
    });
  }

  /**
   * Get subtasks for a goal
   */
  private async getSubtasks(goalId: number) {
    return this.prisma.goal_subtasks.findMany({
      where: { goal_id: goalId },
      orderBy: { order_index: 'asc' },
    });
  }

  /**
   * Log activity for a goal
   */
  private async logActivity(
    goalId: number,
    actor: string,
    activityType: string,
    message: string,
    metadata?: any
  ): Promise<void> {
    await this.prisma.goal_activity_logs.create({
      data: {
        goal_id: goalId,
        actor,
        activity_type: activityType,
        message,
        metadata: metadata || {},
      },
    });
  }

  /**
   * Get or create execution state
   */
  private async getExecutionState() {
    let state = await this.prisma.execution_state.findFirst();
    
    if (!state) {
      state = await this.prisma.execution_state.create({
        data: {
          is_running: false,
        },
      });
    }
    
    return state;
  }

  /**
   * Update execution state
   */
  private async updateExecutionState(data: any) {
    const state = await this.getExecutionState();
    
    return this.prisma.execution_state.update({
      where: { id: state.id },
      data,
    });
  }

  /**
   * Extract JSON from LLM response
   */
  private extractJSON(text: string): any {
    try {
      // Try to find JSON in the response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Try parsing the whole response
      return JSON.parse(text);
    } catch (error) {
      this.logger.error('Failed to parse JSON from LLM response:', error);
      throw new Error('Invalid JSON response from LLM');
    }
  }
}
