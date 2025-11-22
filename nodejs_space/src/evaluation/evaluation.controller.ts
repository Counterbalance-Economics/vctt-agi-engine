
import { Controller, Get, Post, Patch, Param, Body, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { EvaluationService } from './evaluation.service';

@ApiTags('evaluation')
@Controller('evaluations')
export class EvaluationController {
  private readonly logger = new Logger(EvaluationController.name);

  constructor(private readonly evaluationService: EvaluationService) {}

  @Post()
  @ApiOperation({ summary: 'Record an evaluation' })
  @ApiResponse({ status: 201, description: 'Evaluation recorded' })
  async recordEvaluation(@Body() data: any) {
    return this.evaluationService.recordEvaluation(data);
  }

  @Get()
  @ApiOperation({ summary: 'Get evaluations' })
  @ApiQuery({ name: 'sessionId', required: false })
  @ApiQuery({ name: 'episodeType', required: false })
  @ApiQuery({ name: 'minTau', required: false, type: 'number' })
  @ApiQuery({ name: 'maxTau', required: false, type: 'number' })
  @ApiQuery({ name: 'success', required: false, type: 'boolean' })
  @ApiQuery({ name: 'limit', required: false, type: 'number' })
  @ApiResponse({ status: 200, description: 'List of evaluations' })
  async getEvaluations(@Query() query: any) {
    return this.evaluationService.getEvaluations({
      sessionId: query.sessionId,
      episodeType: query.episodeType,
      minTau: query.minTau ? parseFloat(query.minTau) : undefined,
      maxTau: query.maxTau ? parseFloat(query.maxTau) : undefined,
      success: query.success === 'true' ? true : query.success === 'false' ? false : undefined,
      limit: query.limit ? parseInt(query.limit) : undefined,
    });
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get evaluation statistics' })
  @ApiQuery({ name: 'days', required: false, type: 'number' })
  @ApiResponse({ status: 200, description: 'Evaluation statistics' })
  async getStatistics(@Query('days') days?: string) {
    return this.evaluationService.getStatistics(days ? parseInt(days) : 7);
  }

  @Patch(':id/rating')
  @ApiOperation({ summary: 'Add human rating to evaluation' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        rating: { type: 'number', minimum: 1, maximum: 5 },
        feedback: { type: 'string' },
      },
      required: ['rating'],
    },
  })
  @ApiResponse({ status: 200, description: 'Rating added' })
  async addRating(@Param('id') id: string, @Body() body: { rating: number; feedback?: string }) {
    return this.evaluationService.addHumanRating(parseInt(id), body.rating, body.feedback);
  }
}
