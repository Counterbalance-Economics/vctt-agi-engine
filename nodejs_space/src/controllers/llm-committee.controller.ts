
import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { LLMCommitteeService } from '../services/llm-committee.service';
import { LLMCommitteeQueryDto, SessionCommitteeStatsDto, GlobalCommitteeStatsDto } from '../dto/llm-committee.dto';

/**
 * LLM Committee Controller
 * 
 * Provides transparency into which LLMs are doing the work.
 * Enables the "LLM Committee" panel in the UI.
 */
@ApiTags('LLM Committee')
@Controller('api/v1/analytics/llm-committee')
export class LLMCommitteeController {
  private readonly logger = new Logger(LLMCommitteeController.name);

  constructor(private readonly committeeService: LLMCommitteeService) {}

  @Get('session/:sessionId')
  @ApiOperation({ 
    summary: 'Get LLM Committee statistics for a specific session',
    description: 'Shows which models contributed to answers in this conversation, plus offline counts',
  })
  @ApiParam({ name: 'sessionId', description: 'Session/Conversation ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Session committee statistics',
    type: SessionCommitteeStatsDto,
  })
  async getSessionStats(@Param('sessionId') sessionId: string): Promise<SessionCommitteeStatsDto> {
    this.logger.log(`📊 LLM Committee - Session stats requested: ${sessionId}`);
    return this.committeeService.getSessionStats(sessionId);
  }

  @Get('global')
  @ApiOperation({ 
    summary: 'Get global LLM Committee statistics',
    description: 'Shows which models contributed across the last N questions (default: 50)',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Global committee statistics',
    type: GlobalCommitteeStatsDto,
  })
  async getGlobalStats(@Query() query: LLMCommitteeQueryDto): Promise<GlobalCommitteeStatsDto> {
    const limit = query.limit || 50;
    this.logger.log(`📊 LLM Committee - Global stats requested (last ${limit} questions)`);
    return this.committeeService.getGlobalStats(limit);
  }
}
