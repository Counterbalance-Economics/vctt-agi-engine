
import { Controller, Get, Post, Patch, Param, Body, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { CoachService } from './coach.service';

@ApiTags('coach')
@Controller('api/coach')
export class CoachController {
  private readonly logger = new Logger(CoachController.name);

  constructor(private readonly coachService: CoachService) {}

  @Get('proposals')
  @ApiOperation({ summary: 'Get all Coach proposals', description: 'Returns all Coach improvement proposals, optionally filtered by status' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'rejected', 'testing', 'implemented'] })
  @ApiResponse({ status: 200, description: 'List of Coach proposals' })
  async getProposals(@Query('status') status?: string) {
    this.logger.log(`📋 Coach: Fetching proposals (status: ${status || 'all'})`);
    return this.coachService.getAllProposals(status);
  }

  @Get('proposals/pending')
  @ApiOperation({ summary: 'Get pending proposals', description: 'Returns all proposals awaiting human review' })
  @ApiResponse({ status: 200, description: 'List of pending Coach proposals' })
  async getPendingProposals() {
    this.logger.log('📋 Coach: Fetching pending proposals');
    return this.coachService.getPendingProposals();
  }

  @Get('proposals/:id')
  @ApiOperation({ summary: 'Get proposal by ID' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiResponse({ status: 200, description: 'Coach proposal details' })
  @ApiResponse({ status: 404, description: 'Proposal not found' })
  async getProposal(@Param('id') id: string) {
    this.logger.log(`📋 Coach: Fetching proposal #${id}`);
    return this.coachService.getProposalById(parseInt(id));
  }

  @Patch('proposals/:id/approve')
  @ApiOperation({ summary: 'Approve a Coach proposal', description: 'Approves a proposal for implementation' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reviewedBy: { type: 'string', example: 'user@example.com' },
        reviewNotes: { type: 'string', example: 'Approved for A/B testing' },
      },
      required: ['reviewedBy'],
    },
  })
  @ApiResponse({ status: 200, description: 'Proposal approved' })
  async approveProposal(@Param('id') id: string, @Body() body: { reviewedBy: string; reviewNotes?: string }) {
    this.logger.log(`✅ Coach: Approving proposal #${id} by ${body.reviewedBy}`);
    return this.coachService.approveProposal(parseInt(id), body.reviewedBy, body.reviewNotes);
  }

  @Patch('proposals/:id/reject')
  @ApiOperation({ summary: 'Reject a Coach proposal', description: 'Rejects a proposal permanently' })
  @ApiParam({ name: 'id', type: 'number' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reviewedBy: { type: 'string', example: 'user@example.com' },
        reviewNotes: { type: 'string', example: 'Not aligned with VCTT principles' },
      },
      required: ['reviewedBy'],
    },
  })
  @ApiResponse({ status: 200, description: 'Proposal rejected' })
  async rejectProposal(@Param('id') id: string, @Body() body: { reviewedBy: string; reviewNotes?: string }) {
    this.logger.log(`❌ Coach: Rejecting proposal #${id} by ${body.reviewedBy}`);
    return this.coachService.rejectProposal(parseInt(id), body.reviewedBy, body.reviewNotes);
  }

  @Post('trigger-analysis')
  @ApiOperation({ summary: 'Manually trigger Coach analysis', description: 'Runs the nightly Coach analysis immediately (for testing)' })
  @ApiResponse({ status: 200, description: 'Analysis triggered' })
  async triggerAnalysis() {
    this.logger.log('🧠 Coach: Manual analysis triggered');
    await this.coachService.triggerManualAnalysis();
    return { message: 'Coach analysis started' };
  }
}
