
import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LLMContribution } from '../entities/llm-contribution.entity';
import { Message } from '../entities/message.entity';
import { ModelStats, SessionCommitteeStatsDto, GlobalCommitteeStatsDto } from '../dto/llm-committee.dto';

/**
 * LLM Committee Service
 * 
 * Tracks and aggregates LLM contributions across the system.
 * Provides transparency into which models are actually doing the work.
 */
@Injectable()
export class LLMCommitteeService {
  private readonly logger = new Logger(LLMCommitteeService.name);

  constructor(
    @Optional() @InjectRepository(LLMContribution)
    private readonly contributionRepo: Repository<LLMContribution> | null,
    @Optional() @InjectRepository(Message)
    private readonly messageRepo: Repository<Message> | null,
  ) {}

  /**
   * Record an LLM contribution during pipeline execution
   */
  async recordContribution(data: {
    session_id: string;
    message_id?: string;
    model_name: string;
    agent_name: string;
    contributed: boolean;
    offline: boolean;
    error_type?: string;
    tokens_used?: number;
    cost_usd?: number;
    latency_ms?: number;
  }): Promise<void> {
    if (!this.contributionRepo) {
      this.logger.debug('Database not available - skipping contribution recording');
      return;
    }
    
    try {
      const contribution = new LLMContribution();
      contribution.session_id = data.session_id;
      contribution.model_name = data.model_name;
      contribution.agent_name = data.agent_name;
      contribution.contributed = data.contributed;
      contribution.offline = data.offline;
      contribution.tokens_used = data.tokens_used || 0;
      contribution.cost_usd = data.cost_usd || 0;
      contribution.latency_ms = data.latency_ms || 0;
      
      if (data.message_id) {
        contribution.message_id = data.message_id;
      }
      if (data.error_type) {
        contribution.error_type = data.error_type;
      }

      await this.contributionRepo.save(contribution);
    } catch (error) {
      this.logger.error(`Failed to record LLM contribution: ${error.message}`);
      // Don't throw - this is telemetry, shouldn't break the pipeline
    }
  }

  /**
   * Get LLM Committee statistics for a specific session
   */
  async getSessionStats(sessionId: string): Promise<SessionCommitteeStatsDto> {
    if (!this.contributionRepo || !this.messageRepo) {
      this.logger.debug('Database not available - returning empty stats');
      return {
        session_id: sessionId,
        total_questions: 0,
        models: [],
        generated_at: new Date(),
      };
    }
    
    this.logger.log(`Getting LLM Committee stats for session: ${sessionId}`);

    // Get all contributions for this session
    const contributions = await this.contributionRepo.find({
      where: { session_id: sessionId },
      order: { timestamp: 'ASC' },
    });

    // Count user messages (questions) in this session
    const questionCount = await this.messageRepo.count({
      where: { 
        conversation_id: sessionId,
        role: 'user',
      },
    });

    // Aggregate by model
    const modelMap = new Map<string, {
      answered: number;
      total: number;
      offline_count: number;
      total_latency: number;
      total_cost: number;
      invocation_count: number;
    }>();

    for (const contrib of contributions) {
      if (!modelMap.has(contrib.model_name)) {
        modelMap.set(contrib.model_name, {
          answered: 0,
          total: 0,
          offline_count: 0,
          total_latency: 0,
          total_cost: 0,
          invocation_count: 0,
        });
      }

      const stats = modelMap.get(contrib.model_name)!;
      stats.invocation_count++;
      
      if (contrib.contributed) {
        stats.answered++;
      }
      
      if (contrib.offline) {
        stats.offline_count++;
      }

      stats.total_latency += contrib.latency_ms;
      stats.total_cost += Number(contrib.cost_usd);
    }

    // Build response
    const models: ModelStats[] = Array.from(modelMap.entries()).map(([model_name, stats]) => ({
      model_name,
      answered: stats.answered,
      total: questionCount,
      percentage: questionCount > 0 ? (stats.answered / questionCount) * 100 : 0,
      offline_count: stats.offline_count,
      avg_latency_ms: stats.invocation_count > 0 
        ? Math.round(stats.total_latency / stats.invocation_count)
        : 0,
      total_cost_usd: Number(stats.total_cost.toFixed(6)),
    }));

    // Sort by percentage (descending)
    models.sort((a, b) => b.percentage - a.percentage);

    return {
      session_id: sessionId,
      total_questions: questionCount,
      models,
      generated_at: new Date(),
    };
  }

  /**
   * Get global LLM Committee statistics (last N questions)
   */
  async getGlobalStats(limit: number = 50): Promise<GlobalCommitteeStatsDto> {
    if (!this.contributionRepo || !this.messageRepo) {
      this.logger.debug('Database not available - returning empty global stats');
      return {
        questions_analyzed: 0,
        time_range_start: new Date(),
        time_range_end: new Date(),
        models: [],
        generated_at: new Date(),
      };
    }
    
    this.logger.log(`Getting global LLM Committee stats (last ${limit} questions)`);

    // Get the last N user messages (questions)
    const recentQuestions = await this.messageRepo.find({
      where: { role: 'user' },
      order: { timestamp: 'DESC' },
      take: limit,
    });

    if (recentQuestions.length === 0) {
      return {
        questions_analyzed: 0,
        time_range_start: new Date(),
        time_range_end: new Date(),
        models: [],
        generated_at: new Date(),
      };
    }

    const sessionIds = [...new Set(recentQuestions.map(q => q.conversation_id))];
    const oldestTimestamp = recentQuestions[recentQuestions.length - 1].timestamp;
    const newestTimestamp = recentQuestions[0].timestamp;

    // Get all contributions for these sessions within the time range
    const contributions = await this.contributionRepo
      .createQueryBuilder('contrib')
      .where('contrib.session_id IN (:...sessionIds)', { sessionIds })
      .andWhere('contrib.timestamp >= :start', { start: oldestTimestamp })
      .andWhere('contrib.timestamp <= :end', { end: newestTimestamp })
      .orderBy('contrib.timestamp', 'ASC')
      .getMany();

    // Aggregate by model
    const modelMap = new Map<string, {
      answered: number;
      offline_count: number;
      total_latency: number;
      total_cost: number;
      invocation_count: number;
    }>();

    for (const contrib of contributions) {
      if (!modelMap.has(contrib.model_name)) {
        modelMap.set(contrib.model_name, {
          answered: 0,
          offline_count: 0,
          total_latency: 0,
          total_cost: 0,
          invocation_count: 0,
        });
      }

      const stats = modelMap.get(contrib.model_name)!;
      stats.invocation_count++;
      
      if (contrib.contributed) {
        stats.answered++;
      }
      
      if (contrib.offline) {
        stats.offline_count++;
      }

      stats.total_latency += contrib.latency_ms;
      stats.total_cost += Number(contrib.cost_usd);
    }

    // Build response
    const totalQuestions = recentQuestions.length;
    const models: ModelStats[] = Array.from(modelMap.entries()).map(([model_name, stats]) => ({
      model_name,
      answered: stats.answered,
      total: totalQuestions,
      percentage: totalQuestions > 0 ? (stats.answered / totalQuestions) * 100 : 0,
      offline_count: stats.offline_count,
      avg_latency_ms: stats.invocation_count > 0 
        ? Math.round(stats.total_latency / stats.invocation_count)
        : 0,
      total_cost_usd: Number(stats.total_cost.toFixed(6)),
    }));

    // Sort by percentage (descending)
    models.sort((a, b) => b.percentage - a.percentage);

    return {
      questions_analyzed: totalQuestions,
      time_range_start: oldestTimestamp,
      time_range_end: newestTimestamp,
      models,
      generated_at: new Date(),
    };
  }
}
