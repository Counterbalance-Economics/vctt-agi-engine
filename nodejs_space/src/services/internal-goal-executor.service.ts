
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal } from '../entities/goal.entity';
import { LLMCascadeService } from './llm-cascade.service';
import { LLMCommitteeService } from './llm-committee.service';

/**
 * Internal Goal Executor Service
 * 
 * Executes goals using the internal LLM cascade system (Grok, Claude, GPT, etc.)
 * This is the REALITY mode executor - no simulation, real LLM calls!
 */

export interface ExecutionResult {
  success: boolean;
  output: string;
  artifacts?: any[];
  cost_usd: number;
  total_tokens: number;
  models_used: string[];
  execution_time_ms: number;
  error?: string;
}

@Injectable()
export class InternalGoalExecutorService {
  private readonly logger = new Logger(InternalGoalExecutorService.name);

  constructor(
    @InjectRepository(Goal)
    private goalRepository: Repository<Goal>,
    private llmCascade: LLMCascadeService,
    private committeeService: LLMCommitteeService,
  ) {
    this.logger.log('🎯 Internal Goal Executor initialized - REALITY MODE with LLM Cascade');
  }

  /**
   * Execute a goal using the LLM cascade system
   */
  async executeGoal(goalId: number, goalTitle: string, goalDescription: string, sessionId: string): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`🚀 Executing goal ${goalId}: "${goalTitle}" with LLM cascade`);

      // Set session ID for contribution tracking
      this.llmCascade.setSessionId(sessionId);

      // Step 1: Synthesizer breaks down the goal
      this.logger.log(`📋 Step 1: Breaking down goal with Synthesizer...`);
      const breakdownMessages = [
        {
          role: 'user',
          content: `You are MIN's Synthesizer agent. Break down this goal into concrete, executable steps:
          
Title: ${goalTitle}
Description: ${goalDescription}

Provide:
1. A clear execution plan (3-5 steps)
2. Expected deliverables
3. Technical approach
4. Success criteria

Be specific and actionable.`
        }
      ];

      const breakdown = await this.llmCascade.callRole(
        'synthesiser',
        breakdownMessages,
        'You are MIN\'s Synthesizer - expert at breaking down complex goals into actionable plans.',
        0.7
      );

      this.logger.log(`✅ Breakdown complete (${breakdown.model})`);

      // Step 2: Analyst validates feasibility
      this.logger.log(`🔍 Step 2: Validating feasibility with Analyst...`);
      const analysisMessages = [
        {
          role: 'user',
          content: `Review this execution plan and validate its feasibility:

Goal: ${goalTitle}
Plan: ${breakdown.content}

Assess:
1. Technical feasibility (0-100%)
2. Potential blockers
3. Required resources
4. Risk factors

Be honest and thorough.`
        }
      ];

      const analysis = await this.llmCascade.callRole(
        'analyst',
        analysisMessages,
        'You are MIN\'s Analyst - expert at evaluating technical feasibility.',
        0.5
      );

      this.logger.log(`✅ Analysis complete (${analysis.model})`);

      // Step 3: Check if goal is feasible
      const feasibilityMatch = analysis.content.match(/(\d+)%/);
      const feasibility = feasibilityMatch ? parseInt(feasibilityMatch[1]) : 70;

      if (feasibility < 30) {
        this.logger.warn(`⚠️  Low feasibility (${feasibility}%), marking as failed`);
        
        return {
          success: false,
          output: `Goal analysis indicates low feasibility (${feasibility}%).\n\nAnalysis:\n${analysis.content}`,
          cost_usd: breakdown.cost + analysis.cost,
          total_tokens: breakdown.tokensUsed.total + analysis.tokensUsed.total,
          models_used: [breakdown.model, analysis.model],
          execution_time_ms: Date.now() - startTime,
          error: `Feasibility too low: ${feasibility}%`
        };
      }

      // Step 4: Executor generates the solution
      this.logger.log(`⚡ Step 3: Generating solution with Executor...`);
      const executorMessages = [
        {
          role: 'user',
          content: `Execute this goal based on the approved plan:

Goal: ${goalTitle}
Description: ${goalDescription}

Execution Plan:
${breakdown.content}

Feasibility Assessment:
${analysis.content}

Generate:
1. Complete solution/implementation
2. Code (if applicable)
3. Documentation
4. Testing notes

Deliver a production-ready result.`
        }
      ];

      const execution = await this.llmCascade.callRole(
        'executor',
        executorMessages,
        'You are MIN\'s Executor - expert at implementing solutions with precision and quality.',
        0.8
      );

      this.logger.log(`✅ Execution complete (${execution.model})`);

      // Step 5: Verification verifies the output
      this.logger.log(`🔬 Step 4: Verifying output with Verification agent...`);
      const verificationMessages = [
        {
          role: 'user',
          content: `Verify this solution meets the goal requirements:

Goal: ${goalTitle}
Solution:
${execution.content}

Check:
1. Completeness
2. Quality
3. Correctness
4. Deployment readiness

Provide verification score (0-100%) and recommendations.`
        }
      ];

      const verification = await this.llmCascade.callRole(
        'verification',
        verificationMessages,
        'You are MIN\'s Verification agent - expert at quality assurance and testing.',
        0.3
      );

      this.logger.log(`✅ Verification complete (${verification.model})`);

      // Calculate totals
      const totalCost = breakdown.cost + analysis.cost + execution.cost + verification.cost;
      const totalTokens = 
        breakdown.tokensUsed.total + 
        analysis.tokensUsed.total + 
        execution.tokensUsed.total + 
        verification.tokensUsed.total;
      
      const modelsUsed = [
        breakdown.model,
        analysis.model,
        execution.model,
        verification.model
      ];

      // Combine all outputs
      const finalOutput = `# Goal Execution Report: ${goalTitle}

## 1. Execution Plan
${breakdown.content}

## 2. Feasibility Analysis
${analysis.content}

## 3. Solution Implementation
${execution.content}

## 4. Verification Results
${verification.content}

---
**Execution Summary:**
- Total Cost: $${totalCost.toFixed(4)}
- Total Tokens: ${totalTokens.toLocaleString()}
- Models Used: ${modelsUsed.join(', ')}
- Execution Time: ${((Date.now() - startTime) / 1000).toFixed(1)}s
`;

      this.logger.log(`🎉 Goal ${goalId} executed successfully! Cost: $${totalCost.toFixed(4)}, Tokens: ${totalTokens}`);

      return {
        success: true,
        output: finalOutput,
        cost_usd: totalCost,
        total_tokens: totalTokens,
        models_used: modelsUsed,
        execution_time_ms: Date.now() - startTime,
      };

    } catch (error) {
      this.logger.error(`❌ Goal execution failed: ${error.message}`, error.stack);
      
      return {
        success: false,
        output: `Execution failed: ${error.message}`,
        cost_usd: 0,
        total_tokens: 0,
        models_used: [],
        execution_time_ms: Date.now() - startTime,
        error: error.message,
      };
    }
  }
}
