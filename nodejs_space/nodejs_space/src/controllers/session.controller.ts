
import { Controller, Post, Get, Body, Param, ValidationPipe, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { VCTTEngineService } from '../services/vctt-engine.service';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { CostLimitGuard } from '../guards/cost-limit.guard';
import {
  StartSessionDto,
  ProcessStepDto,
  SessionResponseDto,
  StepResponseDto,
  SessionDetailsDto,
} from '../dto/session.dto';

@ApiTags('session')
@Controller('api/v1/session')
@UseGuards(RateLimitGuard, CostLimitGuard)
export class SessionController {
  constructor(private readonly engine: VCTTEngineService) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Start a new VCTT-AGI conversation session',
    description: 'Initializes a new conversation session with default internal state and processes the initial user input.',
  })
  @ApiResponse({
    status: 201,
    description: 'Session successfully created',
    type: SessionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input parameters',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded - too many requests',
  })
  @ApiResponse({
    status: 402,
    description: 'Cost limit exceeded for user or session',
  })
  @ApiResponse({
    status: 503,
    description: 'Service unavailable - daily cost limit exceeded',
  })
  async startSession(
    @Body(ValidationPipe) body: StartSessionDto,
  ): Promise<SessionResponseDto> {
    const sessionId = await this.engine.startSession(body.user_id, body.input);
    return { session_id: sessionId };
  }

  @Post('step')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process a conversation step',
    description: 'Processes user input through the full VCTT-AGI pipeline: Agents → Modules → Repair Loop → Response Generation.',
  })
  @ApiResponse({
    status: 200,
    description: 'Step successfully processed',
    type: StepResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input parameters',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded - too many requests',
  })
  @ApiResponse({
    status: 402,
    description: 'Cost limit exceeded for user or session',
  })
  @ApiResponse({
    status: 503,
    description: 'Service unavailable - daily cost limit exceeded',
  })
  async processStep(
    @Body(ValidationPipe) body: ProcessStepDto,
  ): Promise<StepResponseDto> {
    return await this.engine.processStep(body.session_id, body.input);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get full session details',
    description: 'Retrieves complete conversation history and current internal state for a session.',
  })
  @ApiParam({
    name: 'id',
    description: 'Session ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Session details retrieved',
    type: SessionDetailsDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Session not found',
  })
  async getSession(@Param('id') id: string): Promise<SessionDetailsDto> {
    return await this.engine.getSession(id);
  }
}
