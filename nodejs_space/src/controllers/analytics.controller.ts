
import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from '../services/analytics.service';

@ApiTags('analytics')
@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('sessions')
  @ApiOperation({ summary: 'Get all sessions for a user' })
  @ApiQuery({ name: 'user_id', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit results', type: Number })
  @ApiResponse({ status: 200, description: 'Returns list of sessions' })
  async getSessions(
    @Query('user_id') userId?: string,
    @Query('limit') limit?: number,
  ) {
    return this.analyticsService.getSessions(userId, limit);
  }

  @Get('sessions/:sessionId/history')
  @ApiOperation({ summary: 'Get session history with messages' })
  @ApiParam({ name: 'sessionId', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Returns session history' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getSessionHistory(@Param('sessionId') sessionId: string) {
    return this.analyticsService.getSessionHistory(sessionId);
  }

  @Get('trust-metrics')
  @ApiOperation({ summary: 'Get trust metrics over time' })
  @ApiQuery({ name: 'user_id', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'session_id', required: false, description: 'Filter by session ID' })
  @ApiResponse({ status: 200, description: 'Returns trust metrics history' })
  async getTrustMetrics(
    @Query('user_id') userId?: string,
    @Query('session_id') sessionId?: string,
  ) {
    return this.analyticsService.getTrustMetrics(userId, sessionId);
  }

  @Get('aggregate')
  @ApiOperation({ summary: 'Get aggregate analytics across all sessions' })
  @ApiQuery({ name: 'user_id', required: false, description: 'Filter by user ID' })
  @ApiResponse({ status: 200, description: 'Returns aggregate statistics' })
  async getAggregateAnalytics(@Query('user_id') userId?: string) {
    return this.analyticsService.getAggregateAnalytics(userId);
  }

  @Get('cross-session-patterns')
  @ApiOperation({ summary: 'Get cross-session learning patterns' })
  @ApiQuery({ name: 'user_id', required: false, description: 'Filter by user ID' })
  @ApiResponse({ status: 200, description: 'Returns cross-session patterns and insights' })
  async getCrossSessionPatterns(@Query('user_id') userId?: string) {
    return this.analyticsService.getCrossSessionPatterns(userId);
  }
}
