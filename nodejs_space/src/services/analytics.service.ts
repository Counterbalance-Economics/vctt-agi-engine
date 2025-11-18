
import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { InternalState } from '../entities/internal-state.entity';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @Optional() @InjectRepository(Conversation) private convRepo: Repository<Conversation> | null,
    @Optional() @InjectRepository(Message) private msgRepo: Repository<Message> | null,
    @Optional() @InjectRepository(InternalState) private stateRepo: Repository<InternalState> | null,
  ) {}

  /**
   * Get all sessions with basic info
   */
  async getSessions(userId?: string, limit: number = 50) {
    this.logger.log(`Getting sessions${userId ? ` for user ${userId}` : ''}`);

    const queryBuilder = this.convRepo!.createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.messages', 'message')
      .orderBy('conversation.created_at', 'DESC')
      .take(limit);

    if (userId) {
      queryBuilder.where('conversation.user_id = :userId', { userId });
    }

    const conversations = await queryBuilder.getMany();

    return {
      total: conversations.length,
      sessions: await Promise.all(conversations.map(async (conv) => {
        const state = await this.stateRepo!.findOne({ 
          where: { session_id: conv.id } 
        });

        const messageCount = conv.messages.length;
        const lastMessage = conv.messages[messageCount - 1];

        return {
          session_id: conv.id,
          user_id: conv.user_id,
          created_at: conv.created_at,
          message_count: messageCount,
          last_activity: lastMessage?.timestamp || conv.created_at,
          trust_tau: state?.state?.trust_tau || 1.0,
          repair_count: state?.state?.repair_count || 0,
        };
      })),
    };
  }

  /**
   * Get full session history
   */
  async getSessionHistory(sessionId: string) {
    this.logger.log(`Getting session history: ${sessionId}`);

    const conversation = await this.convRepo!.findOne({
      where: { id: sessionId },
      relations: ['messages'],
    });

    if (!conversation) {
      throw new NotFoundException(`Session not found: ${sessionId}`);
    }

    const state = await this.stateRepo!.findOne({
      where: { session_id: sessionId },
    });

    return {
      session_id: conversation.id,
      user_id: conversation.user_id,
      created_at: conversation.created_at,
      messages: conversation.messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
      internal_state: state?.state || null,
      last_updated: state?.updated_at || null,
    };
  }

  /**
   * Get trust metrics over time
   */
  async getTrustMetrics(userId?: string, sessionId?: string) {
    this.logger.log('Getting trust metrics');

    // Get states
    let stateQuery = this.stateRepo!.createQueryBuilder('state')
      .orderBy('state.updated_at', 'ASC');

    if (sessionId) {
      stateQuery = stateQuery.where('state.session_id = :sessionId', { sessionId });
    }

    const states = await stateQuery.getMany();

    // Get conversations to filter by user_id if needed
    let conversationMap = new Map<string, any>();
    if (userId || !sessionId) {
      const sessionIds = states.map(s => s.session_id);
      if (sessionIds.length > 0) {
        let convQuery = this.convRepo!.createQueryBuilder('conv')
          .where('conv.id IN (:...sessionIds)', { sessionIds });

        if (userId) {
          convQuery = convQuery.andWhere('conv.user_id = :userId', { userId });
        }

        const conversations = await convQuery.getMany();
        conversationMap = new Map(conversations.map(c => [c.id, c]));
      }
    }

    // Build metrics
    const metrics = states
      .filter(s => {
        // Filter by userId if specified
        if (userId) {
          return conversationMap.has(s.session_id);
        }
        return true;
      })
      .map(s => {
        const conv = conversationMap.get(s.session_id);
        return {
          session_id: s.session_id,
          user_id: conv?.user_id || null,
          timestamp: s.updated_at,
          trust_tau: s.state?.trust_tau || 1.0,
          contradiction: s.state?.contradiction || 0.0,
          sim: s.state?.sim || {},
          regulation: s.state?.regulation || 'normal',
          repair_count: s.state?.repair_count || 0,
        };
      });

    return {
      total: metrics.length,
      metrics,
    };
  }

  /**
   * Get aggregate analytics
   */
  async getAggregateAnalytics(userId?: string) {
    this.logger.log(`Getting aggregate analytics${userId ? ` for user ${userId}` : ''}`);

    let query = this.convRepo!.createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.messages', 'message');

    if (userId) {
      query = query.where('conversation.user_id = :userId', { userId });
    }

    const conversations = await query.getMany();
    
    // Get states separately to avoid join type issues
    let states: InternalState[];
    if (userId) {
      // Filter states by conversations for this user
      const sessionIds = conversations.map(c => c.id);
      if (sessionIds.length > 0) {
        states = await this.stateRepo!.createQueryBuilder('state')
          .where('state.session_id IN (:...sessionIds)', { sessionIds })
          .getMany();
      } else {
        states = [];
      }
    } else {
      states = await this.stateRepo!.find();
    }

    // Calculate aggregates
    const totalSessions = conversations.length;
    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
    
    const trustScores = states.map(s => s.state?.trust_tau || 1.0);
    const avgTrust = trustScores.length > 0 
      ? trustScores.reduce((sum, val) => sum + val, 0) / trustScores.length 
      : 1.0;

    const repairCounts = states.map(s => s.state?.repair_count || 0);
    const totalRepairs = repairCounts.reduce((sum, val) => sum + val, 0);
    const avgRepairs = repairCounts.length > 0
      ? totalRepairs / repairCounts.length
      : 0;

    const regulationModes = states.map(s => s.state?.regulation || 'normal');
    const regulationDistribution = {
      normal: regulationModes.filter(r => r === 'normal').length,
      clarify: regulationModes.filter(r => r === 'clarify').length,
      slow_down: regulationModes.filter(r => r === 'slow_down').length,
    };

    return {
      overview: {
        total_sessions: totalSessions,
        total_messages: totalMessages,
        avg_messages_per_session: totalSessions > 0 ? totalMessages / totalSessions : 0,
      },
      trust_metrics: {
        average_trust_tau: avgTrust,
        min_trust: trustScores.length > 0 ? Math.min(...trustScores) : 1.0,
        max_trust: trustScores.length > 0 ? Math.max(...trustScores) : 1.0,
      },
      repair_metrics: {
        total_repairs: totalRepairs,
        avg_repairs_per_session: avgRepairs,
        max_repairs: repairCounts.length > 0 ? Math.max(...repairCounts) : 0,
      },
      regulation: regulationDistribution,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get cross-session patterns and learning insights
   */
  async getCrossSessionPatterns(userId?: string) {
    this.logger.log('Analyzing cross-session patterns');

    let query = this.convRepo!.createQueryBuilder('conversation')
      .leftJoinAndSelect('conversation.messages', 'message')
      .orderBy('conversation.created_at', 'ASC');

    if (userId) {
      query = query.where('conversation.user_id = :userId', { userId });
    }

    const conversations = await query.getMany();

    if (conversations.length === 0) {
      return {
        total_sessions: 0,
        patterns: [],
        insights: ['No session data available for analysis'],
      };
    }

    const states = await this.stateRepo!.find();
    const stateMap = new Map(states.map(s => [s.session_id, s]));

    // Analyze patterns
    const patterns = [];
    const insights = [];

    // Pattern 1: Trust evolution over sessions
    const trustEvolution = conversations.map(conv => {
      const state = stateMap.get(conv.id);
      return {
        session_id: conv.id,
        created_at: conv.created_at,
        trust_tau: state?.state?.trust_tau || 1.0,
      };
    });

    // Check if trust is improving
    if (trustEvolution.length >= 2) {
      const firstTrust = trustEvolution[0].trust_tau;
      const lastTrust = trustEvolution[trustEvolution.length - 1].trust_tau;
      const change = lastTrust - firstTrust;

      if (Math.abs(change) > 0.05) {
        insights.push(
          change > 0 
            ? `Trust has increased by ${(change * 100).toFixed(1)}% over time, indicating improving conversation quality`
            : `Trust has decreased by ${(Math.abs(change) * 100).toFixed(1)}% over time, suggesting areas for improvement`
        );
      }
    }

    patterns.push({
      type: 'trust_evolution',
      data: trustEvolution,
    });

    // Pattern 2: Repair frequency trend
    const repairTrend = conversations.map(conv => {
      const state = stateMap.get(conv.id);
      return {
        session_id: conv.id,
        repair_count: state?.state?.repair_count || 0,
      };
    });

    const avgRepairCount = repairTrend.reduce((sum, r) => sum + r.repair_count, 0) / repairTrend.length;
    if (avgRepairCount > 1) {
      insights.push(`Average repair count is ${avgRepairCount.toFixed(1)}, indicating moderate conversational complexity`);
    }

    patterns.push({
      type: 'repair_frequency',
      data: repairTrend,
    });

    // Pattern 3: Engagement metrics
    const engagementMetrics = conversations.map(conv => {
      const userMessages = conv.messages.filter(m => m.role === 'user').length;
      const assistantMessages = conv.messages.filter(m => m.role === 'assistant').length;
      
      return {
        session_id: conv.id,
        user_messages: userMessages,
        assistant_messages: assistantMessages,
        total_exchanges: Math.min(userMessages, assistantMessages),
      };
    });

    const avgExchanges = engagementMetrics.reduce((sum, e) => sum + e.total_exchanges, 0) / engagementMetrics.length;
    insights.push(`Average conversation length: ${avgExchanges.toFixed(1)} exchanges per session`);

    patterns.push({
      type: 'engagement',
      data: engagementMetrics,
    });

    return {
      total_sessions: conversations.length,
      patterns,
      insights,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get cost analytics with detailed breakdown
   */
  async getCostAnalytics(filters?: {
    userId?: string;
    sessionId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    this.logger.log('Getting cost analytics');

    let query = this.msgRepo!.createQueryBuilder('message')
      .leftJoin('message.conversation', 'conversation')
      .where('message.role = :role', { role: 'assistant' })
      .andWhere('message.cost_usd IS NOT NULL');

    if (filters?.sessionId) {
      query = query.andWhere('message.conversation_id = :sessionId', { 
        sessionId: filters.sessionId 
      });
    }

    if (filters?.userId) {
      query = query.andWhere('conversation.user_id = :userId', { 
        userId: filters.userId 
      });
    }

    if (filters?.startDate) {
      query = query.andWhere('message.timestamp >= :startDate', { 
        startDate: filters.startDate 
      });
    }

    if (filters?.endDate) {
      query = query.andWhere('message.timestamp <= :endDate', { 
        endDate: filters.endDate 
      });
    }

    const messages = await query
      .select([
        'message.id',
        'message.conversation_id',
        'message.timestamp',
        'message.model',
        'message.tokens_input',
        'message.tokens_output',
        'message.tokens_total',
        'message.cost_usd',
        'message.latency_ms',
      ])
      .getRawMany();

    // Calculate aggregates
    const totalCost = messages.reduce((sum, m) => sum + (parseFloat(m.message_cost_usd) || 0), 0);
    const totalTokens = messages.reduce((sum, m) => sum + (m.message_tokens_total || 0), 0);
    const totalCalls = messages.length;
    const avgLatency = messages.length > 0
      ? messages.reduce((sum, m) => sum + (m.message_latency_ms || 0), 0) / messages.length
      : 0;

    // Model breakdown
    const modelBreakdown: Record<string, any> = {};
    messages.forEach(m => {
      const model = m.message_model || 'unknown';
      if (!modelBreakdown[model]) {
        modelBreakdown[model] = {
          calls: 0,
          tokens: 0,
          cost: 0,
          avg_latency: 0,
          latencies: [],
        };
      }
      modelBreakdown[model].calls++;
      modelBreakdown[model].tokens += m.message_tokens_total || 0;
      modelBreakdown[model].cost += parseFloat(m.message_cost_usd) || 0;
      if (m.message_latency_ms) {
        modelBreakdown[model].latencies.push(m.message_latency_ms);
      }
    });

    // Calculate average latencies
    Object.keys(modelBreakdown).forEach(model => {
      const latencies = modelBreakdown[model].latencies;
      modelBreakdown[model].avg_latency = latencies.length > 0
        ? latencies.reduce((sum: number, l: number) => sum + l, 0) / latencies.length
        : 0;
      delete modelBreakdown[model].latencies;
    });

    // Daily cost breakdown
    const dailyBreakdown: Record<string, number> = {};
    messages.forEach(m => {
      const date = new Date(m.message_timestamp).toISOString().split('T')[0];
      dailyBreakdown[date] = (dailyBreakdown[date] || 0) + (parseFloat(m.message_cost_usd) || 0);
    });

    return {
      summary: {
        total_cost_usd: totalCost,
        total_tokens: totalTokens,
        total_llm_calls: totalCalls,
        avg_cost_per_call: totalCalls > 0 ? totalCost / totalCalls : 0,
        avg_tokens_per_call: totalCalls > 0 ? totalTokens / totalCalls : 0,
        avg_latency_ms: avgLatency,
      },
      model_breakdown: modelBreakdown,
      daily_breakdown: Object.entries(dailyBreakdown).map(([date, cost]) => ({
        date,
        cost_usd: cost,
      })).sort((a, b) => a.date.localeCompare(b.date)),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(filters?: {
    userId?: string;
    sessionId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    this.logger.log('Getting performance metrics');

    let query = this.msgRepo!.createQueryBuilder('message')
      .leftJoin('message.conversation', 'conversation')
      .where('message.role = :role', { role: 'assistant' })
      .andWhere('message.latency_ms IS NOT NULL');

    if (filters?.sessionId) {
      query = query.andWhere('message.conversation_id = :sessionId', { 
        sessionId: filters.sessionId 
      });
    }

    if (filters?.userId) {
      query = query.andWhere('conversation.user_id = :userId', { 
        userId: filters.userId 
      });
    }

    if (filters?.startDate) {
      query = query.andWhere('message.timestamp >= :startDate', { 
        startDate: filters.startDate 
      });
    }

    if (filters?.endDate) {
      query = query.andWhere('message.timestamp <= :endDate', { 
        endDate: filters.endDate 
      });
    }

    const messages = await query
      .select([
        'message.id',
        'message.timestamp',
        'message.model',
        'message.tokens_total',
        'message.latency_ms',
      ])
      .getRawMany();

    if (messages.length === 0) {
      return {
        summary: {
          total_requests: 0,
          avg_latency_ms: 0,
          min_latency_ms: 0,
          max_latency_ms: 0,
          p50_latency_ms: 0,
          p95_latency_ms: 0,
          p99_latency_ms: 0,
        },
        latency_distribution: [],
        hourly_performance: [],
        timestamp: new Date().toISOString(),
      };
    }

    // Calculate latency percentiles
    const latencies = messages
      .map(m => m.message_latency_ms)
      .filter(l => l != null)
      .sort((a, b) => a - b);

    const getPercentile = (arr: number[], p: number) => {
      const index = Math.ceil(arr.length * p) - 1;
      return arr[Math.max(0, index)];
    };

    const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;

    // Hourly performance breakdown
    const hourlyPerformance: Record<string, { count: number; total_latency: number }> = {};
    messages.forEach(m => {
      const hour = new Date(m.message_timestamp).toISOString().split(':')[0] + ':00';
      if (!hourlyPerformance[hour]) {
        hourlyPerformance[hour] = { count: 0, total_latency: 0 };
      }
      hourlyPerformance[hour].count++;
      hourlyPerformance[hour].total_latency += m.message_latency_ms || 0;
    });

    return {
      summary: {
        total_requests: messages.length,
        avg_latency_ms: avgLatency,
        min_latency_ms: Math.min(...latencies),
        max_latency_ms: Math.max(...latencies),
        p50_latency_ms: getPercentile(latencies, 0.5),
        p95_latency_ms: getPercentile(latencies, 0.95),
        p99_latency_ms: getPercentile(latencies, 0.99),
      },
      latency_distribution: [
        { range: '0-1s', count: latencies.filter(l => l < 1000).length },
        { range: '1-2s', count: latencies.filter(l => l >= 1000 && l < 2000).length },
        { range: '2-5s', count: latencies.filter(l => l >= 2000 && l < 5000).length },
        { range: '5-10s', count: latencies.filter(l => l >= 5000 && l < 10000).length },
        { range: '10s+', count: latencies.filter(l => l >= 10000).length },
      ],
      hourly_performance: Object.entries(hourlyPerformance).map(([hour, data]) => ({
        hour,
        requests: data.count,
        avg_latency_ms: data.total_latency / data.count,
      })).sort((a, b) => a.hour.localeCompare(b.hour)),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(
    format: 'json' | 'csv',
    filters?: {
      userId?: string;
      sessionId?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    this.logger.log(`Exporting analytics as ${format}`);

    let query = this.msgRepo!.createQueryBuilder('message')
      .leftJoin('message.conversation', 'conversation')
      .addSelect(['conversation.id', 'conversation.user_id', 'conversation.created_at'])
      .where('message.role = :role', { role: 'assistant' });

    if (filters?.sessionId) {
      query = query.andWhere('message.conversation_id = :sessionId', { 
        sessionId: filters.sessionId 
      });
    }

    if (filters?.userId) {
      query = query.andWhere('conversation.user_id = :userId', { 
        userId: filters.userId 
      });
    }

    if (filters?.startDate) {
      query = query.andWhere('message.timestamp >= :startDate', { 
        startDate: filters.startDate 
      });
    }

    if (filters?.endDate) {
      query = query.andWhere('message.timestamp <= :endDate', { 
        endDate: filters.endDate 
      });
    }

    const results = await query.getMany();

    const exportData = results.map(m => ({
      message_id: m.id,
      session_id: m.conversation_id,
      user_id: m.conversation?.user_id || null,
      timestamp: m.timestamp,
      model: m.model || null,
      tokens_input: m.tokens_input || 0,
      tokens_output: m.tokens_output || 0,
      tokens_total: m.tokens_total || 0,
      cost_usd: m.cost_usd ? parseFloat(m.cost_usd.toString()) : 0,
      latency_ms: m.latency_ms || 0,
    }));

    if (format === 'csv') {
      // Convert to CSV
      if (exportData.length === 0) {
        return 'No data available';
      }

      const headers = Object.keys(exportData[0]).join(',');
      const rows = exportData.map(row => 
        Object.values(row).map(val => 
          typeof val === 'string' && val.includes(',') ? `"${val}"` : val
        ).join(',')
      );

      return [headers, ...rows].join('\n');
    }

    return exportData;
  }
}
