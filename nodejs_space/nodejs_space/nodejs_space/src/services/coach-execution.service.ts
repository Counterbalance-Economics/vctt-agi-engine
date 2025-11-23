
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal } from '../entities/goal.entity';

/**
 * Coach Execution Service - Phase 3
 * 
 * Analyzes execution results and proposes improvements.
 * Integrates with the Coach system to generate proposals based on autonomous work.
 */

export interface CoachProposal {
  id: number;
  queue_id?: number;
  goal_id: number;
  proposal_type: string;
  title: string;
  description: string;
  rationale?: string;
  estimated_impact?: string;
  auto_approved: boolean;
  status: string;
  metadata?: any;
  created_at: Date;
}

@Injectable()
export class CoachExecutionService {
  private readonly logger = new Logger(CoachExecutionService.name);

  constructor(
    @InjectRepository(Goal)
    private goalRepository: Repository<Goal>,
  ) {
    this.logger.log('🎓 Coach Execution Service initialized');
  }

  /**
   * Analyze execution result and generate proposals
   */
  async analyzeExecution(queueId: number, goalId: number, result: any) {
    const db = this.goalRepository.manager;

    this.logger.log(`🔍 Analyzing execution ${queueId} for goal ${goalId}`);

    try {
      // TODO: Implement actual AI-powered analysis
      // For now, generate sample proposals based on execution

      const proposals: Partial<CoachProposal>[] = [];

      // Example: If execution took too long, propose optimization
      if (result.duration > 300000) { // >5 minutes
        proposals.push({
          queue_id: queueId,
          goal_id: goalId,
          proposal_type: 'optimization',
          title: 'Optimize execution performance',
          description: 'Execution took longer than expected. Consider optimizing task decomposition or resource allocation.',
          rationale: `Execution duration: ${result.duration}ms`,
          estimated_impact: 'medium',
          auto_approved: false,
          status: 'pending',
        });
      }

      // Example: If execution succeeded, propose test coverage
      if (result.success) {
        proposals.push({
          queue_id: queueId,
          goal_id: goalId,
          proposal_type: 'test_coverage',
          title: 'Add test coverage for completed work',
          description: 'Consider adding automated tests to ensure quality and prevent regressions.',
          rationale: 'Successful execution completed - good opportunity for test coverage',
          estimated_impact: 'high',
          auto_approved: false,
          status: 'pending',
        });
      }

      // Save proposals to database
      for (const proposal of proposals) {
        await this.createProposal(proposal);
      }

      this.logger.log(`✅ Generated ${proposals.length} proposals for goal ${goalId}`);

      return proposals;

    } catch (error) {
      this.logger.error(`Failed to analyze execution: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a coach proposal
   */
  async createProposal(data: Partial<CoachProposal>) {
    const db = this.goalRepository.manager;

    const result = await db.query(`
      INSERT INTO coach_execution_proposals 
        (queue_id, goal_id, proposal_type, title, description, rationale, estimated_impact, auto_approved, status, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      data.queue_id || null,
      data.goal_id,
      data.proposal_type,
      data.title,
      data.description,
      data.rationale || null,
      data.estimated_impact || 'medium',
      data.auto_approved || false,
      data.status || 'pending',
      JSON.stringify(data.metadata || {}),
    ]);

    this.logger.log(`➕ Created coach proposal: ${data.title}`);

    return result[0];
  }

  /**
   * Get proposals for a goal
   */
  async getProposals(goalId: number, status?: string) {
    const db = this.goalRepository.manager;

    let query = `
      SELECT * FROM coach_execution_proposals
      WHERE goal_id = $1
    `;

    const params: any[] = [goalId];

    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC`;

    return await db.query(query, params);
  }

  /**
   * Approve a proposal
   */
  async approveProposal(proposalId: number) {
    const db = this.goalRepository.manager;

    await db.query(`
      UPDATE coach_execution_proposals
      SET status = 'approved'
      WHERE id = $1
    `, [proposalId]);

    this.logger.log(`✅ Proposal ${proposalId} approved`);
  }

  /**
   * Reject a proposal
   */
  async rejectProposal(proposalId: number, reason?: string) {
    const db = this.goalRepository.manager;

    await db.query(`
      UPDATE coach_execution_proposals
      SET status = 'rejected',
          metadata = metadata || jsonb_build_object('rejection_reason', $2)
      WHERE id = $1
    `, [proposalId, reason || 'No reason provided']);

    this.logger.log(`❌ Proposal ${proposalId} rejected`);
  }

  /**
   * Get pending proposals count
   */
  async getPendingCount() {
    const db = this.goalRepository.manager;

    const result = await db.query(`
      SELECT COUNT(*) as count
      FROM coach_execution_proposals
      WHERE status = 'pending'
    `);

    return parseInt(result[0].count);
  }
}
