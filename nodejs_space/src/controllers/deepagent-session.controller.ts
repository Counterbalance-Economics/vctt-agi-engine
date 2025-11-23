
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { DeepAgentSessionService } from '../services/deepagent-session.service';
import type { CreateDeepAgentSessionDto, UpdateDeepAgentSessionDto } from '../services/deepagent-session.service';

@ApiTags('DeepAgent Sessions')
@Controller('api/deepagent')
export class DeepAgentSessionController {
  private readonly logger = new Logger(DeepAgentSessionController.name);

  constructor(
    private readonly deepAgentSessionService: DeepAgentSessionService,
  ) {
    this.logger.log('🔌 DeepAgent Session Controller initialized');
  }

  /**
   * Create a new DeepAgent session
   */
  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Create DeepAgent session',
    description: 'Creates a new DeepAgent session for working on a goal or subtask. Returns session details with UUID for tracking.',
  })
  @ApiResponse({ status: 201, description: 'Session created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async createSession(@Body() dto: CreateDeepAgentSessionDto) {
    this.logger.log(`📝 Creating DeepAgent session for: ${dto.context?.title || 'Unknown'}`);
    return this.deepAgentSessionService.createSession(dto);
  }

  /**
   * Get session by ID or UUID
   */
  @Get('sessions/:identifier')
  @ApiOperation({ 
    summary: 'Get session details',
    description: 'Retrieves detailed information about a DeepAgent session including activity history.',
  })
  @ApiParam({ 
    name: 'identifier', 
    description: 'Session ID (number) or UUID (string)',
    example: '123 or abc-def-ghi',
  })
  @ApiResponse({ status: 200, description: 'Session found' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getSession(@Param('identifier') identifier: string) {
    // Try to parse as number, otherwise treat as UUID
    const id = !isNaN(Number(identifier)) ? Number(identifier) : identifier;
    return this.deepAgentSessionService.getSession(id);
  }

  /**
   * Update session status/results
   */
  @Patch('sessions/:identifier')
  @ApiOperation({ 
    summary: 'Update session',
    description: 'Updates a DeepAgent session status, results, or metadata. Use this to mark sessions as in_progress, completed, or failed.',
  })
  @ApiParam({ 
    name: 'identifier', 
    description: 'Session ID (number) or UUID (string)',
  })
  @ApiResponse({ status: 200, description: 'Session updated successfully' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async updateSession(
    @Param('identifier') identifier: string,
    @Body() dto: UpdateDeepAgentSessionDto,
  ) {
    const id = !isNaN(Number(identifier)) ? Number(identifier) : identifier;
    this.logger.log(`📝 Updating DeepAgent session ${identifier}: ${dto.status || 'metadata'}`);
    return this.deepAgentSessionService.updateSession(id, dto);
  }

  /**
   * Get all sessions for a goal
   */
  @Get('goals/:goalId/sessions')
  @ApiOperation({ 
    summary: 'Get sessions for goal',
    description: 'Retrieves all DeepAgent sessions associated with a specific goal.',
  })
  @ApiParam({ name: 'goalId', description: 'Goal ID' })
  @ApiResponse({ status: 200, description: 'Sessions retrieved successfully' })
  async getSessionsForGoal(@Param('goalId') goalId: string) {
    return this.deepAgentSessionService.getSessionsForGoal(Number(goalId));
  }

  /**
   * Get all sessions for a subtask
   */
  @Get('subtasks/:subtaskId/sessions')
  @ApiOperation({ 
    summary: 'Get sessions for subtask',
    description: 'Retrieves all DeepAgent sessions associated with a specific subtask.',
  })
  @ApiParam({ name: 'subtaskId', description: 'Subtask ID' })
  @ApiResponse({ status: 200, description: 'Sessions retrieved successfully' })
  async getSessionsForSubtask(@Param('subtaskId') subtaskId: string) {
    return this.deepAgentSessionService.getSessionsForSubtask(Number(subtaskId));
  }
}
