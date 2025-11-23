
import { Controller, Get, Post, Body, Param, Query, Logger } from '@nestjs/common';
import { AutonomousOrchestratorService } from '../services/autonomous-orchestrator.service';
import { PriorityEngineService } from '../services/priority-engine.service';
import { LLMCoachService } from '../services/llm-coach.service';
import { RealTimeSessionService } from '../services/realtime-session.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DataSource } from 'typeorm';

/**
 * Autonomous Execution Controller - Phase 4
 * 
 * API endpoints for managing autonomous execution system:
 * - Real DeepAgent session spawning
 * - LLM-powered coach analysis
 * - Auto-prioritization engine
 * - Swarm mode monitoring
 */

@ApiTags('Autonomous Execution')
@Controller('api/autonomous')
export class AutonomousExecutionController {
  private readonly logger = new Logger(AutonomousExecutionController.name);

  constructor(
    private readonly orchestratorService: AutonomousOrchestratorService,
    private readonly priorityEngine: PriorityEngineService,
    private readonly coachService: LLMCoachService,
    private readonly sessionService: RealTimeSessionService,
    private readonly dataSource: DataSource,
  ) {
    this.logger.log('🤖 Autonomous Execution Controller initialized (Phase 4 - Full Reality)');
  }

  /**
   * Get queue status and statistics
   * GET /api/autonomous/status
   */
  @Get('status')
  @ApiOperation({ summary: 'Get autonomous execution system status' })
  @ApiResponse({ status: 200, description: 'Returns queue status and statistics' })
  async getStatus() {
    try {
      const status = await this.orchestratorService.getQueueStatus();

      return {
        success: true,
        status,
        message: 'Autonomous execution system is operational',
      };
    } catch (error) {
      this.logger.error(`Failed to get status: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Manually queue a goal for execution
   * POST /api/autonomous/queue
   */
  @Post('queue')
  @ApiOperation({ summary: 'Manually add a goal to the execution queue' })
  @ApiResponse({ status: 200, description: 'Goal queued successfully' })
  async queueGoal(@Body() data: { goal_id: number; priority?: number }) {
    try {
      const result = await this.orchestratorService.queueGoal(
        data.goal_id,
        data.priority || 3
      );

      return {
        success: true,
        queue_item: result,
        message: 'Goal queued for autonomous execution',
      };
    } catch (error) {
      this.logger.error(`Failed to queue goal: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get execution logs for a goal
   * GET /api/autonomous/logs/:goalId
   */
  @Get('logs/:goalId')
  @ApiOperation({ summary: 'Get execution logs for a specific goal' })
  @ApiResponse({ status: 200, description: 'Returns execution logs' })
  async getExecutionLogs(
    @Param('goalId') goalId: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const logs = await this.orchestratorService.getExecutionLogs(
        parseInt(goalId),
        limit ? parseInt(limit) : 50
      );

      return {
        success: true,
        goal_id: parseInt(goalId),
        logs,
        count: logs.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get logs: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Trigger orchestration manually (for testing)
   * POST /api/autonomous/orchestrate
   */
  @Post('orchestrate')
  @ApiOperation({ summary: 'Manually trigger orchestration cycle (admin)' })
  @ApiResponse({ status: 200, description: 'Orchestration triggered' })
  async triggerOrchestration() {
    try {
      // Run orchestration in background
      this.orchestratorService.orchestrate();

      return {
        success: true,
        message: 'Orchestration cycle triggered',
      };
    } catch (error) {
      this.logger.error(`Failed to trigger orchestration: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Analyze a goal with LLM coach
   * POST /api/autonomous/coach/analyze
   */
  @Post('coach/analyze')
  @ApiOperation({ summary: 'Get LLM coach analysis for a goal' })
  @ApiResponse({ status: 200, description: 'Coach analysis returned' })
  async analyzeGoal(@Body() data: { goal_id: number; title: string; description: string }) {
    try {
      this.logger.log(`Running coach analysis for: ${data.title}`);

      const analysis = await this.coachService.analyzeGoal(data.title, data.description);

      return {
        success: true,
        goal_id: data.goal_id,
        analysis,
        message: 'Coach analysis complete',
      };
    } catch (error) {
      this.logger.error(`Coach analysis failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Trigger auto-prioritization for all active goals
   * POST /api/autonomous/prioritize
   */
  @Post('prioritize')
  @ApiOperation({ summary: 'Run auto-prioritization on all active goals' })
  @ApiResponse({ status: 200, description: 'Prioritization complete' })
  async reprioritizeGoals() {
    try {
      this.logger.log('Running auto-prioritization...');

      const results = await this.priorityEngine.reprioritizeAll();

      return {
        success: true,
        goals_processed: results.length,
        priority_scores: results,
        message: 'Auto-prioritization complete',
      };
    } catch (error) {
      this.logger.error(`Prioritization failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get priority explanation for a specific goal
   * GET /api/autonomous/priority/:goalId
   */
  @Get('priority/:goalId')
  @ApiOperation({ summary: 'Get priority explanation for a goal' })
  @ApiResponse({ status: 200, description: 'Priority explanation returned' })
  async getPriorityExplanation(@Param('goalId') goalId: string) {
    try {
      const explanation = await this.priorityEngine.explainPriority(parseInt(goalId));

      return {
        success: true,
        goal_id: parseInt(goalId),
        explanation,
      };
    } catch (error) {
      this.logger.error(`Failed to get priority explanation: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get active DeepAgent sessions
   * GET /api/autonomous/sessions
   */
  @Get('sessions')
  @ApiOperation({ summary: 'Get all active DeepAgent sessions' })
  @ApiResponse({ status: 200, description: 'Active sessions returned' })
  async getActiveSessions() {
    try {
      const sessions = this.sessionService.getActiveSessions();

      return {
        success: true,
        count: sessions.length,
        sessions,
      };
    } catch (error) {
      this.logger.error(`Failed to get sessions: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get session status
   * GET /api/autonomous/session/:sessionId
   */
  @Get('session/:sessionId')
  @ApiOperation({ summary: 'Get status of a specific session' })
  @ApiResponse({ status: 200, description: 'Session status returned' })
  async getSessionStatus(@Param('sessionId') sessionId: string) {
    try {
      const session = await this.sessionService.getSessionStatus(sessionId);

      if (!session) {
        return {
          success: false,
          error: 'Session not found',
        };
      }

      return {
        success: true,
        session,
      };
    } catch (error) {
      this.logger.error(`Failed to get session status: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Run database migration to create execution tables
   * POST /api/autonomous/migrate
   * ADMIN ONLY - Run this once to set up production database
   */
  @Post('migrate')
  @ApiOperation({ summary: 'Create execution queue tables (ADMIN ONLY - run once)' })
  @ApiResponse({ status: 200, description: 'Migration completed' })
  async runMigration() {
    try {
      this.logger.log('🔧 Running execution queue migration...');

      // Create execution_queue table
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS execution_queue (
          id SERIAL PRIMARY KEY,
          goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
          subtask_id INTEGER,
          priority INTEGER DEFAULT 3,
          status VARCHAR(20) DEFAULT 'queued',
          attempts INTEGER DEFAULT 0,
          max_attempts INTEGER DEFAULT 3,
          assigned_agent VARCHAR(255),
          session_id VARCHAR(255),
          error_message TEXT,
          queued_at TIMESTAMP DEFAULT NOW(),
          started_at TIMESTAMP,
          completed_at TIMESTAMP,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      this.logger.log('✅ execution_queue table created');

      // Create execution_logs table
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS execution_logs (
          id SERIAL PRIMARY KEY,
          queue_id INTEGER REFERENCES execution_queue(id) ON DELETE CASCADE,
          goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
          log_level VARCHAR(20) DEFAULT 'info',
          message TEXT NOT NULL,
          details JSONB DEFAULT '{}',
          timestamp TIMESTAMP DEFAULT NOW()
        );
      `);
      this.logger.log('✅ execution_logs table created');

      // Create agent_pool table
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS agent_pool (
          id SERIAL PRIMARY KEY,
          agent_id VARCHAR(255) UNIQUE NOT NULL,
          status VARCHAR(20) DEFAULT 'idle',
          current_goal_id INTEGER,
          current_session_id VARCHAR(255),
          capabilities JSONB DEFAULT '[]',
          last_active TIMESTAMP DEFAULT NOW(),
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
      this.logger.log('✅ agent_pool table created');

      // Create indexes for performance
      await this.dataSource.query(`
        CREATE INDEX IF NOT EXISTS idx_execution_queue_status ON execution_queue(status);
        CREATE INDEX IF NOT EXISTS idx_execution_queue_goal ON execution_queue(goal_id);
        CREATE INDEX IF NOT EXISTS idx_execution_logs_goal ON execution_logs(goal_id);
        CREATE INDEX IF NOT EXISTS idx_agent_pool_status ON agent_pool(status);
      `);
      this.logger.log('✅ Indexes created');

      return {
        success: true,
        message: 'Database migration completed successfully',
        tables_created: ['execution_queue', 'execution_logs', 'agent_pool'],
        indexes_created: 4,
      };
    } catch (error) {
      this.logger.error(`Migration failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        hint: 'Tables may already exist. Check error details.',
      };
    }
  }
}
