
import { Controller, Get, Param, Query, NotFoundException, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from '../services/analytics.service';
import { CostAnalyticsQueryDto, ExportQueryDto } from '../dto/analytics.dto';

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

  @Get('cost')
  @ApiOperation({ 
    summary: 'Get cost analytics with detailed breakdown',
    description: 'Returns LLM usage costs, token counts, model breakdown, and daily trends'
  })
  @ApiQuery({ name: 'user_id', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'session_id', required: false, description: 'Filter by session ID' })
  @ApiQuery({ name: 'range', required: false, description: 'Date range: today, week, month, all' })
  @ApiQuery({ name: 'start_date', required: false, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'end_date', required: false, description: 'End date (ISO format)' })
  @ApiResponse({ status: 200, description: 'Returns cost analytics' })
  async getCostAnalytics(@Query() query: CostAnalyticsQueryDto) {
    const filters = this.parseFilters(query);
    return this.analyticsService.getCostAnalytics(filters);
  }

  @Get('performance')
  @ApiOperation({ 
    summary: 'Get performance metrics',
    description: 'Returns latency statistics, percentiles, and hourly performance trends'
  })
  @ApiQuery({ name: 'user_id', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'session_id', required: false, description: 'Filter by session ID' })
  @ApiQuery({ name: 'range', required: false, description: 'Date range: today, week, month, all' })
  @ApiQuery({ name: 'start_date', required: false, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'end_date', required: false, description: 'End date (ISO format)' })
  @ApiResponse({ status: 200, description: 'Returns performance metrics' })
  async getPerformanceMetrics(@Query() query: CostAnalyticsQueryDto) {
    const filters = this.parseFilters(query);
    return this.analyticsService.getPerformanceMetrics(filters);
  }

  @Get('export')
  @ApiOperation({ 
    summary: 'Export analytics data',
    description: 'Export detailed analytics data as JSON or CSV'
  })
  @ApiQuery({ name: 'format', required: false, description: 'Export format: json or csv', enum: ['json', 'csv'] })
  @ApiQuery({ name: 'user_id', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'session_id', required: false, description: 'Filter by session ID' })
  @ApiQuery({ name: 'range', required: false, description: 'Date range: today, week, month, all' })
  @ApiQuery({ name: 'start_date', required: false, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'end_date', required: false, description: 'End date (ISO format)' })
  @ApiResponse({ status: 200, description: 'Returns exported data' })
  async exportAnalytics(@Query() query: ExportQueryDto) {
    const format = query.format || 'json';
    const filters = this.parseFilters(query);
    const data = await this.analyticsService.exportAnalytics(format, filters);
    
    if (format === 'csv') {
      return data;
    }
    
    return data;
  }

  /**
   * Parse query filters and apply date range presets
   */
  private parseFilters(query: CostAnalyticsQueryDto) {
    const filters: any = {
      userId: query.user_id,
      sessionId: query.session_id,
    };

    // Apply date range presets
    if (query.range) {
      const now = new Date();
      switch (query.range) {
        case 'today':
          filters.startDate = new Date(now.setHours(0, 0, 0, 0));
          filters.endDate = new Date(now.setHours(23, 59, 59, 999));
          break;
        case 'week':
          filters.startDate = new Date(now.setDate(now.getDate() - 7));
          filters.endDate = new Date();
          break;
        case 'month':
          filters.startDate = new Date(now.setMonth(now.getMonth() - 1));
          filters.endDate = new Date();
          break;
        case 'all':
        default:
          // No date filters
          break;
      }
    }

    // Override with explicit dates if provided
    if (query.start_date) {
      filters.startDate = new Date(query.start_date);
    }
    if (query.end_date) {
      filters.endDate = new Date(query.end_date);
    }

    return filters;
  }
}
