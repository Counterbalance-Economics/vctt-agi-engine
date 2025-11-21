
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateEvaluationDto, CreateCoachProposalDto } from './dto/evaluation.dto';

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new evaluation
   */
  async createEvaluation(dto: CreateEvaluationDto, evaluatorId: string = 'system') {
    this.logger.log(
      `Creating evaluation: ${dto.evaluationType} for context ${dto.contextId} | Score: ${dto.score}`,
    );

    const evaluation = await this.prisma.evaluation.create({
      data: {
        contextId: dto.contextId,
        evaluationType: dto.evaluationType,
        score: dto.score,
        criteria: dto.criteria as any,
        humanFeedback: dto.humanFeedback || '',
        evaluatedBy: evaluatorId,
        timestamp: new Date(),
        metadata: dto.metadata || {},
      },
    });

    // Log to autonomy audit
    await this.prisma.autonomyAudit.create({
      data: {
        eventType: 'EVALUATION',
        actorType: 'SYSTEM',
        actorId: evaluatorId,
        action: `CREATE_EVALUATION_${dto.evaluationType}`,
        targetResource: dto.contextId,
        outcome: 'SUCCESS',
        metadata: {
          evaluationId: evaluation.id,
          score: dto.score,
        } as any,
        timestamp: new Date(),
      },
    });

    return evaluation;
  }

  /**
   * Get evaluations with filters
   */
  async getEvaluations(filters?: {
    contextId?: string;
    evaluationType?: string;
    minScore?: number;
    maxScore?: number;
    limit?: number;
  }) {
    const { contextId, evaluationType, minScore, maxScore, limit = 100 } = filters || {};

    return this.prisma.evaluation.findMany({
      where: {
        ...(contextId && { contextId }),
        ...(evaluationType && { evaluationType }),
        ...(minScore !== undefined && { score: { gte: minScore } }),
        ...(maxScore !== undefined && { score: { lte: maxScore } }),
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  /**
   * Create a coach proposal (improvement suggestion)
   */
  async createCoachProposal(dto: CreateCoachProposalDto, createdBy: string = 'COACH_AGENT') {
    this.logger.log(
      `Creating coach proposal: ${dto.improvementArea} for evaluation ${dto.evaluationId}`,
    );

    // Verify evaluation exists
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id: dto.evaluationId },
    });

    if (!evaluation) {
      throw new NotFoundException(`Evaluation ${dto.evaluationId} not found`);
    }

    const proposal = await this.prisma.coachProposal.create({
      data: {
        evaluationId: dto.evaluationId,
        improvementArea: dto.improvementArea,
        proposal: dto.proposal,
        justification: dto.justification,
        estimatedImpact: dto.estimatedImpact || 50,
        priority: dto.priority || 'MEDIUM',
        status: 'PENDING_REVIEW',
        createdBy,
        metadata: {},
      },
    });

    // Log to autonomy audit
    await this.prisma.autonomyAudit.create({
      data: {
        eventType: 'COACH_PROPOSAL',
        actorType: 'AGENT',
        actorId: createdBy,
        action: `PROPOSE_${dto.improvementArea}`,
        targetResource: dto.evaluationId,
        outcome: 'PENDING_REVIEW',
        metadata: {
          proposalId: proposal.id,
          priority: dto.priority,
        } as any,
        timestamp: new Date(),
      },
    });

    return proposal;
  }

  /**
   * Get coach proposals
   */
  async getCoachProposals(filters?: {
    status?: string;
    improvementArea?: string;
    priority?: string;
    limit?: number;
  }) {
    const { status, improvementArea, priority, limit = 100 } = filters || {};

    return this.prisma.coachProposal.findMany({
      where: {
        ...(status && { status }),
        ...(improvementArea && { improvementArea }),
        ...(priority && { priority }),
      },
      include: {
        evaluation: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Approve or reject a coach proposal
   */
  async reviewProposal(proposalId: string, decision: string, humanFeedback?: string) {
    this.logger.log(`Reviewing proposal ${proposalId}: ${decision}`);

    const proposal = await this.prisma.coachProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }

    const updatedProposal = await this.prisma.coachProposal.update({
      where: { id: proposalId },
      data: {
        status: decision,
        humanFeedback: humanFeedback || '',
        reviewedAt: new Date(),
      },
    });

    // Log to autonomy audit
    await this.prisma.autonomyAudit.create({
      data: {
        eventType: 'PROPOSAL_REVIEW',
        actorType: 'HUMAN',
        actorId: 'human_reviewer',
        action: `PROPOSAL_${decision}`,
        targetResource: proposalId,
        outcome: decision,
        metadata: {
          improvementArea: proposal.improvementArea,
          humanFeedback,
        } as any,
        timestamp: new Date(),
      },
    });

    return updatedProposal;
  }

  /**
   * Nightly coach process - runs every day at 2 AM
   * Analyzes recent evaluations and creates improvement proposals
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runNightlyCoachProcess() {
    this.logger.log('🌙 Starting nightly coach process...');

    try {
      // Get recent evaluations (last 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentEvaluations = await this.prisma.evaluation.findMany({
        where: {
          timestamp: {
            gte: yesterday,
          },
        },
        orderBy: { score: 'asc' },
        take: 50,
      });

      this.logger.log(`Found ${recentEvaluations.length} recent evaluations`);

      // Identify low-scoring areas
      const lowScoreEvaluations = recentEvaluations.filter((e) => e.score < 70);

      this.logger.log(`Found ${lowScoreEvaluations.length} low-scoring evaluations (< 70)`);

      // Create improvement proposals for each low-scoring area
      for (const evaluation of lowScoreEvaluations) {
        // Check if we already have a pending proposal for this evaluation
        const existingProposal = await this.prisma.coachProposal.findFirst({
          where: {
            evaluationId: evaluation.id,
            status: 'PENDING_REVIEW',
          },
        });

        if (existingProposal) {
          this.logger.log(`Skipping evaluation ${evaluation.id} - already has pending proposal`);
          continue;
        }

        // Generate improvement proposal
        const proposal = this.generateImprovementProposal(evaluation);

        await this.createCoachProposal(
          {
            evaluationId: evaluation.id,
            improvementArea: proposal.area,
            proposal: proposal.text,
            justification: proposal.justification,
            estimatedImpact: proposal.impact,
            priority: proposal.priority,
          },
          'NIGHTLY_COACH',
        );

        this.logger.log(`Created improvement proposal for ${proposal.area}`);
      }

      // Calculate aggregate metrics
      const avgScore =
        recentEvaluations.reduce((sum, e) => sum + e.score, 0) / recentEvaluations.length || 0;

      this.logger.log(
        `✅ Nightly coach process complete | Avg Score: ${avgScore.toFixed(1)} | Proposals Created: ${lowScoreEvaluations.length}`,
      );

      // Log to autonomy audit
      await this.prisma.autonomyAudit.create({
        data: {
          eventType: 'NIGHTLY_COACH',
          actorType: 'SYSTEM',
          actorId: 'NIGHTLY_COACH',
          action: 'RUN_COACH_PROCESS',
          targetResource: 'ALL_EVALUATIONS',
          outcome: 'SUCCESS',
          metadata: {
            evaluationsAnalyzed: recentEvaluations.length,
            proposalsCreated: lowScoreEvaluations.length,
            avgScore: avgScore.toFixed(1),
          } as any,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Nightly coach process failed: ${error.message}`, error.stack);

      // Log error to autonomy audit
      await this.prisma.autonomyAudit.create({
        data: {
          eventType: 'NIGHTLY_COACH',
          actorType: 'SYSTEM',
          actorId: 'NIGHTLY_COACH',
          action: 'RUN_COACH_PROCESS',
          targetResource: 'ALL_EVALUATIONS',
          outcome: 'FAILED',
          metadata: {
            error: error.message,
          } as any,
          timestamp: new Date(),
        },
      });
    }
  }

  /**
   * Generate improvement proposal based on evaluation
   */
  private generateImprovementProposal(evaluation: any): {
    area: string;
    text: string;
    justification: string;
    impact: number;
    priority: string;
  } {
    const { evaluationType, score, criteria } = evaluation;

    // Simple heuristic-based proposal generator
    // In production, this would call an LLM to generate more sophisticated proposals
    
    let area = evaluationType;
    let text = `Improve ${evaluationType} performance`;
    let justification = `Current score of ${score} is below acceptable threshold`;
    let impact = 100 - score; // Impact is inversely proportional to score
    let priority = score < 50 ? 'HIGH' : score < 70 ? 'MEDIUM' : 'LOW';

    // Add specific recommendations based on criteria
    if (criteria && typeof criteria === 'object') {
      const lowCriteria = Object.entries(criteria)
        .filter(([key, value]) => typeof value === 'number' && value < 70)
        .map(([key]) => key);

      if (lowCriteria.length > 0) {
        text = `Focus on improving: ${lowCriteria.join(', ')}`;
        justification = `These criteria scored below 70: ${lowCriteria.join(', ')}`;
      }
    }

    return { area, text, justification, impact, priority };
  }
}
