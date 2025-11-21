
import { Controller, Post, Get, Patch, Body, Query, Param, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { EvaluationService } from './evaluation.service';
import { CreateEvaluationDto, CreateCoachProposalDto, ApproveProposalDto } from './dto/evaluation.dto';

@ApiTags('Evaluation & Coach')
@Controller('evaluation')
export class EvaluationController {
  private readonly logger = new Logger(EvaluationController.name);

  constructor(private readonly evaluationService: EvaluationService) {}

  @Post()
  @ApiOperation({
    summary: 'Create evaluation',
    description: 'Record an evaluation of system performance',
  })
  async createEvaluation(
    @Body() dto: CreateEvaluationDto,
    @Query('evaluatorId') evaluatorId?: string,
  ) {
    this.logger.log(`Creating evaluation: ${dto.evaluationType}`);
    return this.evaluationService.createEvaluation(dto, evaluatorId || 'system');
  }

  @Get()
  @ApiOperation({
    summary: 'Get evaluations',
    description: 'Retrieve evaluations with optional filters',
  })
  @ApiQuery({ name: 'contextId', required: false })
  @ApiQuery({ name: 'evaluationType', required: false })
  @ApiQuery({ name: 'minScore', required: false, type: Number })
  @ApiQuery({ name: 'maxScore', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getEvaluations(
    @Query('contextId') contextId?: string,
    @Query('evaluationType') evaluationType?: string,
    @Query('minScore') minScore?: string,
    @Query('maxScore') maxScore?: string,
    @Query('limit') limit?: string,
  ) {
    return this.evaluationService.getEvaluations({
      contextId,
      evaluationType,
      minScore: minScore ? parseFloat(minScore) : undefined,
      maxScore: maxScore ? parseFloat(maxScore) : undefined,
      limit: limit ? parseInt(limit) : 100,
    });
  }

  @Post('proposals')
  @ApiOperation({
    summary: 'Create coach proposal',
    description: 'Create an improvement proposal based on an evaluation',
  })
  async createProposal(
    @Body() dto: CreateCoachProposalDto,
    @Query('createdBy') createdBy?: string,
  ) {
    this.logger.log(`Creating coach proposal for evaluation: ${dto.evaluationId}`);
    return this.evaluationService.createCoachProposal(dto, createdBy || 'COACH_AGENT');
  }

  @Get('proposals')
  @ApiOperation({
    summary: 'Get coach proposals',
    description: 'Retrieve improvement proposals with optional filters',
  })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'improvementArea', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getProposals(
    @Query('status') status?: string,
    @Query('improvementArea') improvementArea?: string,
    @Query('priority') priority?: string,
    @Query('limit') limit?: string,
  ) {
    return this.evaluationService.getCoachProposals({
      status,
      improvementArea,
      priority,
      limit: limit ? parseInt(limit) : 100,
    });
  }

  @Patch('proposals/:id/review')
  @ApiOperation({
    summary: 'Review coach proposal',
    description: 'Approve, reject, or request revision for an improvement proposal',
  })
  async reviewProposal(@Param('id') id: string, @Body() dto: ApproveProposalDto) {
    this.logger.log(`Reviewing proposal ${id}: ${dto.decision}`);
    return this.evaluationService.reviewProposal(dto.proposalId, dto.decision, dto.feedback);
  }

  @Post('coach/trigger')
  @ApiOperation({
    summary: 'Manually trigger coach process',
    description: 'Manually run the nightly coach process (normally runs at 2 AM)',
  })
  async triggerCoachProcess() {
    this.logger.log('Manually triggering coach process');
    await this.evaluationService.runNightlyCoachProcess();
    return { message: 'Coach process triggered successfully' };
  }
}
