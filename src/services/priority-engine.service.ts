
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal } from '../entities/goal.entity';

/**
 * Priority Engine Service - Phase 4
 * 
 * Dynamic auto-prioritization based on multiple factors:
 * - Deadline proximity
 * - Estimated effort
 * - Dependency graph
 * - User-set importance multiplier
 */

export interface PriorityScore {
  goal_id: number;
  score: number;
  factors: {
    deadline_urgency: number;
    effort_factor: number;
    dependency_boost: number;
    user_importance: number;
  };
  recommended_priority: number; // 1-5
}

@Injectable()
export class PriorityEngineService {
  private readonly logger = new Logger(PriorityEngineService.name);

  constructor(
    @InjectRepository(Goal)
    private goalRepository: Repository<Goal>,
  ) {
    this.logger.log('🎯 Priority Engine initialized');
  }

  /**
   * Calculate dynamic priority for a goal
   */
  async calculatePriority(goal: Goal): Promise<PriorityScore> {
    const factors = {
      deadline_urgency: this.calculateDeadlineUrgency(goal),
      effort_factor: this.calculateEffortFactor(goal),
      dependency_boost: await this.calculateDependencyBoost(goal),
      user_importance: this.getUserImportance(goal),
    };

    // Weighted score calculation
    const score = 
      factors.deadline_urgency * 0.4 +  // 40% weight on deadline
      factors.effort_factor * 0.2 +     // 20% weight on effort
      factors.dependency_boost * 0.2 +  // 20% weight on dependencies
      factors.user_importance * 0.2;    // 20% weight on user priority

    // Map score to 1-5 priority
    const recommended_priority = this.scoreToPriority(score);

    return {
      goal_id: goal.id,
      score,
      factors,
      recommended_priority,
    };
  }

  /**
   * Calculate urgency based on deadline proximity
   */
  private calculateDeadlineUrgency(goal: Goal): number {
    // Check metadata for target_date
    const metadata = goal.metadata as any || {};
    const targetDate = metadata.target_date || metadata.deadline;

    if (!targetDate) {
      return 0.5; // Neutral score for goals without deadline
    }

    const now = new Date();
    const deadline = new Date(targetDate);
    const daysUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

    if (daysUntilDeadline < 0) {
      return 1.0; // Overdue - maximum urgency
    } else if (daysUntilDeadline < 1) {
      return 0.95; // Due today
    } else if (daysUntilDeadline < 3) {
      return 0.85; // Due within 3 days
    } else if (daysUntilDeadline < 7) {
      return 0.7; // Due within a week
    } else if (daysUntilDeadline < 14) {
      return 0.5; // Due within 2 weeks
    } else if (daysUntilDeadline < 30) {
      return 0.3; // Due within a month
    } else {
      return 0.1; // More than a month away
    }
  }

  /**
   * Calculate factor based on estimated effort
   * Favor quick wins (easier tasks get higher scores)
   */
  private calculateEffortFactor(goal: Goal): number {
    // Check metadata for estimated_effort
    const metadata = goal.metadata as any || {};
    const effort = (metadata.estimated_effort || metadata.effort || 'medium').toLowerCase();

    const effortScores: Record<string, number> = {
      'trivial': 1.0,  // Quick win
      'easy': 0.9,
      'medium': 0.6,
      'hard': 0.3,
      'epic': 0.1,     // Long-term project
    };

    return effortScores[effort] || 0.5;
  }

  /**
   * Calculate boost from dependency graph
   * Goals that block others get higher priority
   */
  private async calculateDependencyBoost(goal: Goal): Promise<number> {
    const db = this.goalRepository.manager;

    // Count how many other goals depend on this one
    const result = await db.query(`
      SELECT COUNT(*) as dependent_count
      FROM goals
      WHERE status = 'active'
      AND dependencies @> $1::jsonb
    `, [JSON.stringify([goal.id])]);

    const dependentCount = parseInt(result[0]?.dependent_count || '0');

    // More dependents = higher boost
    if (dependentCount === 0) return 0.5;
    if (dependentCount === 1) return 0.7;
    if (dependentCount === 2) return 0.85;
    return 1.0; // 3+ goals depend on this
  }

  /**
   * Get user importance multiplier
   */
  private getUserImportance(goal: Goal): number {
    // Map user's priority (1-5) to 0-1 scale
    const priority = goal.priority || 3;
    return (priority - 1) / 4; // Normalize to 0-1
  }

  /**
   * Map calculated score to 1-5 priority
   */
  private scoreToPriority(score: number): number {
    if (score >= 0.8) return 5;
    if (score >= 0.6) return 4;
    if (score >= 0.4) return 3;
    if (score >= 0.2) return 2;
    return 1;
  }

  /**
   * Reprioritize all active goals
   */
  async reprioritizeAll(): Promise<PriorityScore[]> {
    this.logger.log('🔄 Reprioritizing all active goals...');

    const activeGoals = await this.goalRepository.find({
      where: { status: 'active' },
    });

    const scores: PriorityScore[] = [];

    for (const goal of activeGoals) {
      const score = await this.calculatePriority(goal);
      scores.push(score);

      // Update goal priority if significantly different
      if (Math.abs(goal.priority - score.recommended_priority) >= 1) {
        await this.goalRepository.update(goal.id, {
          priority: score.recommended_priority,
        });
        
        this.logger.log(
          `📊 Goal ${goal.id} priority updated: ${goal.priority} → ${score.recommended_priority}`
        );
      }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    this.logger.log(`✅ Reprioritization complete - ${scores.length} goals processed`);

    return scores;
  }

  /**
   * Get priority explanation for a goal
   */
  async explainPriority(goalId: number): Promise<string> {
    const goal = await this.goalRepository.findOne({ where: { id: goalId } });
    if (!goal) {
      return 'Goal not found';
    }

    const score = await this.calculatePriority(goal);

    const parts: string[] = [];

    // Deadline factor
    if (score.factors.deadline_urgency > 0.8) {
      parts.push('⏰ **Urgent deadline**');
    } else if (score.factors.deadline_urgency > 0.6) {
      parts.push('📅 Approaching deadline');
    }

    // Effort factor
    if (score.factors.effort_factor > 0.8) {
      parts.push('⚡ **Quick win** (low effort)');
    } else if (score.factors.effort_factor < 0.3) {
      parts.push('🏔️ High effort required');
    }

    // Dependency factor
    if (score.factors.dependency_boost > 0.7) {
      parts.push('🔗 **Blocks other goals**');
    }

    // User importance
    if (score.factors.user_importance > 0.75) {
      parts.push('⭐ User-marked as high importance');
    }

    if (parts.length === 0) {
      return `Standard priority (score: ${score.score.toFixed(2)})`;
    }

    return parts.join(' • ');
  }
}
