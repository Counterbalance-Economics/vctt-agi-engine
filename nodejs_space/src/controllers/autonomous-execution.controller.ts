
import { Controller, Get, Post, Body, Param, Query, Logger } from '@nestjs/common';
import { AutonomousOrchestratorService } from '../services/autonomous-orchestrator.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

/**
 * Autonomous Execution Controller - Phase 3
 * 
 * API endpoints for managing autonomous execution system.
 */

@ApiTags('Autonomous Execution')
@Controller('api/autonomous')
export class AutonomousExecutionController {
  private readonly logger = new Logger(AutonomousExecutionController.name);

  constructor(
    private readonly orchestratorService: AutonomousOrchestratorService,
  ) {
    this.logger.log('🤖 Autonomous Execution Controller initialized');
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
}
