
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../services/prisma.service';
import axios from 'axios';

@Injectable()
export class CoachService {
  private readonly logger = new Logger(CoachService.name);
  private readonly GROK_API_URL = process.env.GROK_API_URL || 'https://api.x.ai/v1/chat/completions';
  private readonly GROK_API_KEY = process.env.XAI_API_KEY;

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * *', {
    name: 'nightly-coach-analysis',
    timeZone: 'UTC',
  })
  async runNightlyCoachAnalysis() {
    this.logger.log('🧠 COACH: Starting nightly self-improvement analysis...');
    
    try {
      const episodes = await this.sampleEpisodes();
      
      if (episodes.high.length === 0 && episodes.low.length === 0) {
        this.logger.log('📊 COACH: No episodes to analyze. Skipping tonight.');
        return;
      }

      this.logger.log(`📊 COACH: Sampled ${episodes.high.length} high-τ and ${episodes.low.length} low-τ episodes`);

      const analysis = await this.analyzeWithGrok(episodes);
      await this.storeProposals(analysis, episodes);

      this.logger.log('✅ COACH: Nightly analysis complete. Proposals pending human review.');
    } catch (error) {
      this.logger.error('❌ COACH: Nightly analysis failed', error.stack);
    }
  }

  private async sampleEpisodes() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const highTauEpisodes = await this.prisma.evaluations.findMany({
      where: {
        evaluated_at: { gte: sevenDaysAgo },
        trust_tau: { gte: 0.8 },
      },
      orderBy: { trust_tau: 'desc' },
      take: 20,
    });

    const lowTauEpisodes = await this.prisma.evaluations.findMany({
      where: {
        evaluated_at: { gte: sevenDaysAgo },
        trust_tau: { lt: 0.5 },
      },
      orderBy: { trust_tau: 'asc' },
      take: 20,
    });

    return { high: highTauEpisodes, low: lowTauEpisodes };
  }

  private async analyzeWithGrok(episodes: any) {
    const prompt = this.buildCoachPrompt(episodes);

    try {
      const response = await axios.post(
        this.GROK_API_URL,
        {
          model: 'grok-2-1212',
          messages: [
            {
              role: 'system',
              content: 'You are the Coach, an AI that analyzes MIN performance data and proposes concrete improvements. You output only valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 4000,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.GROK_API_KEY}`,
          },
        }
      );

      const content = response.data.choices[0].message.content;
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      
      return JSON.parse(jsonStr);
    } catch (error) {
      this.logger.error('❌ COACH: Grok API call failed', error.message);
      throw error;
    }
  }

  private buildCoachPrompt(episodes: any): string {
    const highSummary = episodes.high.map((e: any) => ({
      tau: e.trust_tau,
      success: e.success,
      latency_ms: e.latency_ms,
      tools: e.tools_used,
      instruction: e.instruction?.substring(0, 200),
    }));

    const lowSummary = episodes.low.map((e: any) => ({
      tau: e.trust_tau,
      success: e.success,
      latency_ms: e.latency_ms,
      error_type: e.error_type,
      contradictions: e.contradiction_count,
      instruction: e.instruction?.substring(0, 200),
    }));

    return `You are the Coach for MIN DeepAgent, a multi-agent AGI IDE.

Your task: Analyze MIN's performance over the last 7 days and extract actionable insights.

## High-Performance Episodes (τ > 0.8)
${JSON.stringify(highSummary, null, 2)}

## Low-Performance Episodes (τ < 0.5)
${JSON.stringify(lowSummary, null, 2)}

## Your Analysis

Extract:
1. **3 Recurring Strengths** - What patterns lead to high τ?
2. **3 Recurring Failure Patterns** - What causes low τ or failures?
3. **Up to 5 Concrete Improvement Proposals**

For each proposal, provide:
- title: Short description
- type: "prompt_refinement", "new_skill", "heuristic", "tool_enhancement"
- current_behavior: What MIN does now
- proposed_behavior: What MIN should do instead
- expected_improvement: Specific, measurable outcome
- confidence: 0.0 to 1.0

Output format (JSON only):
{
  "strengths": ["...", "...", "..."],
  "failure_patterns": ["...", "...", "..."],
  "proposals": [
    {
      "title": "...",
      "type": "...",
      "current_behavior": "...",
      "proposed_behavior": "...",
      "expected_improvement": "...",
      "confidence": 0.85
    }
  ],
  "summary": "One-sentence overall assessment"
}`;
  }

  private async storeProposals(analysis: any, episodes: any) {
    const sampleSize = episodes.high.length + episodes.low.length;

    for (const proposal of analysis.proposals || []) {
      await this.prisma.coach_proposals.create({
        data: {
          title: proposal.title,
          proposal_type: proposal.type,
          analysis_summary: analysis.summary || 'Nightly coach analysis',
          sample_size: sampleSize,
          confidence_score: proposal.confidence,
          current_behavior: proposal.current_behavior,
          proposed_behavior: proposal.proposed_behavior,
          expected_improvement: proposal.expected_improvement,
          supporting_evaluations: {
            high_tau_count: episodes.high.length,
            low_tau_count: episodes.low.length,
            strengths: analysis.strengths,
            failure_patterns: analysis.failure_patterns,
          },
          metrics: {
            avg_high_tau: episodes.high.reduce((acc: number, e: any) => acc + e.trust_tau, 0) / episodes.high.length,
            avg_low_tau: episodes.low.reduce((acc: number, e: any) => acc + e.trust_tau, 0) / episodes.low.length,
          },
          status: 'pending',
        },
      });
    }

    this.logger.log(`✅ COACH: Stored ${analysis.proposals?.length || 0} proposals for human review`);
  }

  async getPendingProposals() {
    return this.prisma.coach_proposals.findMany({
      where: { status: 'pending' },
      orderBy: { confidence_score: 'desc' },
    });
  }

  async getAllProposals(status?: string) {
    return this.prisma.coach_proposals.findMany({
      where: status ? { status } : undefined,
      orderBy: { created_at: 'desc' },
      take: 100,
    });
  }

  async getProposalById(id: number) {
    return this.prisma.coach_proposals.findUnique({
      where: { id },
    });
  }

  async approveProposal(id: number, reviewedBy: string, reviewNotes?: string) {
    return this.prisma.coach_proposals.update({
      where: { id },
      data: {
        status: 'approved',
        reviewed_by: reviewedBy,
        reviewed_at: new Date(),
        review_notes: reviewNotes,
      },
    });
  }

  async rejectProposal(id: number, reviewedBy: string, reviewNotes?: string) {
    return this.prisma.coach_proposals.update({
      where: { id },
      data: {
        status: 'rejected',
        reviewed_by: reviewedBy,
        reviewed_at: new Date(),
        review_notes: reviewNotes,
      },
    });
  }

  async triggerManualAnalysis() {
    this.logger.log('🧠 COACH: Manual analysis triggered');
    return this.runNightlyCoachAnalysis();
  }
}
