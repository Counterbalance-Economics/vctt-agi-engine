
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../services/prisma.service';

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordEvaluation(data: {
    goalId?: number;
    episodeId?: string;
    sessionId: string;
    episodeType: string;
    tauStart?: number;
    tauEnd?: number;
    tauDelta?: number;
    trustTau: number;
    latencyMs: number;
    costUsd?: number;
    successScore?: number;
    success: boolean;
    humanRating?: number;
    humanFeedback?: string;
    contradictionCount?: number;
    repairCount?: number;
    toolCallsCount?: number;
    modelsUsed?: any;
    toolsUsed?: any;
    plannerReasoning?: string;
    errorType?: string;
    instruction?: string;
    responseSummary?: string;
    metadata?: any;
  }) {
    this.logger.log(`📊 Evaluation: Recording episode ${data.episodeId || data.sessionId}`);

    return this.prisma.evaluations.create({
      data: {
        goal_id: data.goalId,
        episode_id: data.episodeId,
        session_id: data.sessionId,
        episode_type: data.episodeType,
        tau_start: data.tauStart,
        tau_end: data.tauEnd,
        tau_delta: data.tauDelta,
        trust_tau: data.trustTau,
        latency_ms: data.latencyMs,
        cost_usd: data.costUsd,
        success_score: data.successScore,
        success: data.success,
        human_rating: data.humanRating,
        human_feedback: data.humanFeedback,
        contradiction_count: data.contradictionCount || 0,
        repair_count: data.repairCount || 0,
        tool_calls_count: data.toolCallsCount || 0,
        models_used: data.modelsUsed,
        tools_used: data.toolsUsed,
        planner_reasoning: data.plannerReasoning,
        error_type: data.errorType,
        instruction: data.instruction,
        response_summary: data.responseSummary,
        metadata: data.metadata,
      },
    });
  }

  async getEvaluations(filters: {
    sessionId?: string;
    episodeType?: string;
    minTau?: number;
    maxTau?: number;
    success?: boolean;
    limit?: number;
  }) {
    const where: any = {};
    
    if (filters.sessionId) where.session_id = filters.sessionId;
    if (filters.episodeType) where.episode_type = filters.episodeType;
    if (filters.minTau !== undefined || filters.maxTau !== undefined) {
      where.trust_tau = {};
      if (filters.minTau !== undefined) where.trust_tau.gte = filters.minTau;
      if (filters.maxTau !== undefined) where.trust_tau.lte = filters.maxTau;
    }
    if (filters.success !== undefined) where.success = filters.success;

    return this.prisma.evaluations.findMany({
      where,
      orderBy: { evaluated_at: 'desc' },
      take: filters.limit || 100,
    });
  }

  async getStatistics(days: number = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const evaluations = await this.prisma.evaluations.findMany({
      where: { evaluated_at: { gte: since } },
    });

    if (evaluations.length === 0) {
      return { total: 0, avgTau: 0, avgLatency: 0, successRate: 0, highTauCount: 0, lowTauCount: 0 };
    }

    const avgTau = evaluations.reduce((sum, e) => sum + e.trust_tau, 0) / evaluations.length;
    const avgLatency = evaluations.reduce((sum, e) => sum + e.latency_ms, 0) / evaluations.length;
    const successRate = evaluations.filter(e => e.success).length / evaluations.length;
    const highTauCount = evaluations.filter(e => e.trust_tau >= 0.8).length;
    const lowTauCount = evaluations.filter(e => e.trust_tau < 0.5).length;

    return { total: evaluations.length, avgTau, avgLatency, successRate, highTauCount, lowTauCount };
  }

  async addHumanRating(evaluationId: number, rating: number, feedback?: string) {
    this.logger.log(`⭐ Evaluation: Adding human rating ${rating}/5 to evaluation #${evaluationId}`);
    
    return this.prisma.evaluations.update({
      where: { id: evaluationId },
      data: { human_rating: rating, human_feedback: feedback },
    });
  }
}
