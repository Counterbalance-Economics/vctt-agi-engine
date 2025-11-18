
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
}
