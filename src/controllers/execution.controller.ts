
import { Controller, Post, Get, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { AgentOrchestratorService } from '../services/agent-orchestrator.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

/**
 * Execution Controller
 * 
 * Controls MIN's autonomous execution loop for goals
 */
@ApiTags('Execution')
@Controller('api/execution')
export class ExecutionController {
  private readonly logger = new Logger(ExecutionController.name);

  constructor(
    private readonly orchestrator: AgentOrchestratorService,
  ) {}

  /**
   * Start autonomous execution
   */
  @Post('start')
  @ApiOperation({ 
    summary: 'Start autonomous execution',
    description: 'Starts MIN\'s autonomous execution loop. MIN will continuously work on active goals, breaking them into subtasks and executing them.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Execution started successfully',
    schema: {
      example: {
        message: 'Autonomous execution started',
        status: {
          isRunning: true,
          startedAt: '2025-11-23T02:00:00.000Z',
        }
      }
    }
  })
  async startExecution() {
    try {
      this.logger.log('▶️ API: Starting autonomous execution');
      await this.orchestrator.startExecution();
      const status = await this.orchestrator.getExecutionStatus();
      
      return {
        message: 'Autonomous execution started',
        status,
      };
    } catch (error) {
      this.logger.error('Failed to start execution:', error);
      throw new HttpException(
        `Failed to start execution: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Stop autonomous execution
   */
  @Post('stop')
  @ApiOperation({ 
    summary: 'Stop autonomous execution',
    description: 'Stops MIN\'s autonomous execution loop. Current task will be completed before stopping.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Execution stopped successfully',
    schema: {
      example: {
        message: 'Autonomous execution stopped',
        status: {
          isRunning: false,
          stoppedAt: '2025-11-23T02:30:00.000Z',
        }
      }
    }
  })
  async stopExecution() {
    try {
      this.logger.log('⏸️ API: Stopping autonomous execution');
      await this.orchestrator.stopExecution();
      const status = await this.orchestrator.getExecutionStatus();
      
      return {
        message: 'Autonomous execution stopped',
        status,
      };
    } catch (error) {
      this.logger.error('Failed to stop execution:', error);
      throw new HttpException(
        `Failed to stop execution: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get execution status
   */
  @Get('status')
  @ApiOperation({ 
    summary: 'Get execution status',
    description: 'Returns the current status of MIN\'s autonomous execution, including what goal is being worked on and statistics.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Execution status retrieved',
    schema: {
      example: {
        isRunning: true,
        currentGoal: {
          id: 1,
          title: 'Build a REST API',
          status: 'active',
          priority: 5
        },
        startedAt: '2025-11-23T02:00:00.000Z',
        lastHeartbeat: '2025-11-23T02:15:00.000Z',
        totalGoalsProcessed: 3,
        totalSubtasksCompleted: 12,
        errorMessage: null
      }
    }
  })
  async getExecutionStatus() {
    try {
      const status = await this.orchestrator.getExecutionStatus();
      return status;
    } catch (error) {
      this.logger.error('Failed to get execution status:', error);
      throw new HttpException(
        `Failed to get execution status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
