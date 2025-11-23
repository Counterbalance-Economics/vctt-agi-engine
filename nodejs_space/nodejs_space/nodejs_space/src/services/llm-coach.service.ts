
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

/**
 * LLM Coach Service - Phase 4
 * 
 * Uses real AI (xAI Grok) to analyze goals, propose strategies, and guide execution.
 * Replaces rule-based heuristics with actual intelligence.
 */

export interface CoachAnalysis {
  feasibility_score: number;  // 0-100
  estimated_effort: 'trivial' | 'easy' | 'medium' | 'hard' | 'epic';
  estimated_hours: number;
  key_challenges: string[];
  recommended_approach: string;
  required_skills: string[];
  dependencies: string[];
  risk_factors: string[];
  success_indicators: string[];
  suggested_priority: number;  // 1-5
}

@Injectable()
export class LLMCoachService {
  private readonly logger = new Logger(LLMCoachService.name);
  private xaiApiKey: string = '';

  constructor() {
    this.loadApiKey();
    this.logger.log('🧠 LLM Coach Service initialized (xAI Grok)');
  }

  /**
   * Load xAI API key from secrets file
   */
  private loadApiKey() {
    try {
      const secretsPath = path.join(process.env.HOME || '/home/ubuntu', '.config', 'abacusai_auth_secrets.json');
      const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
      this.xaiApiKey = secrets?.xai?.secrets?.api_key?.value || '';
      
      if (this.xaiApiKey) {
        this.logger.log('✅ xAI API key loaded successfully');
      } else {
        this.logger.warn('⚠️  xAI API key not found - coach analysis will be degraded');
      }
    } catch (error) {
      this.logger.error(`Failed to load xAI API key: ${error.message}`);
    }
  }

  /**
   * Analyze a goal using LLM intelligence
   */
  async analyzeGoal(title: string, description: string, context?: any): Promise<CoachAnalysis> {
    try {
      if (!this.xaiApiKey) {
        this.logger.warn('⚠️  No API key - falling back to heuristic analysis');
        return this.heuristicAnalysis(title, description);
      }

      this.logger.log(`🤔 Analyzing goal with LLM: "${title}"`);

      const prompt = this.buildAnalysisPrompt(title, description, context);

      const response = await axios.post(
        'https://api.x.ai/v1/chat/completions',
        {
          model: 'grok-beta',
          messages: [
            {
              role: 'system',
              content: 'You are MIN, an expert AI coach analyzing software development goals. Provide structured, actionable analysis in valid JSON format only. No markdown, no explanations outside the JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 1500,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.xaiApiKey}`,
          },
          timeout: 30000,
        }
      );

      const content = response.data.choices[0].message.content;
      
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from LLM response');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      this.logger.log(`✅ LLM analysis complete: ${analysis.feasibility_score}% feasible, ${analysis.estimated_effort} effort`);

      return {
        feasibility_score: analysis.feasibility_score || 75,
        estimated_effort: analysis.estimated_effort || 'medium',
        estimated_hours: analysis.estimated_hours || 4,
        key_challenges: analysis.key_challenges || [],
        recommended_approach: analysis.recommended_approach || 'Standard implementation',
        required_skills: analysis.required_skills || [],
        dependencies: analysis.dependencies || [],
        risk_factors: analysis.risk_factors || [],
        success_indicators: analysis.success_indicators || [],
        suggested_priority: analysis.suggested_priority || 3,
      };

    } catch (error) {
      this.logger.error(`❌ LLM analysis failed: ${error.message}`);
      // Fallback to heuristic analysis
      return this.heuristicAnalysis(title, description);
    }
  }

  /**
   * Build analysis prompt for LLM
   */
  private buildAnalysisPrompt(title: string, description: string, context?: any): string {
    return `
Analyze this software development goal and provide a structured assessment:

**Title:** ${title}

**Description:**
${description}

${context ? `**Context:**\n${JSON.stringify(context, null, 2)}` : ''}

Return ONLY valid JSON with this exact structure (no markdown, no extra text):

{
  "feasibility_score": 85,
  "estimated_effort": "medium",
  "estimated_hours": 6,
  "key_challenges": ["Challenge 1", "Challenge 2"],
  "recommended_approach": "Brief strategy description",
  "required_skills": ["Skill 1", "Skill 2"],
  "dependencies": ["Dependency 1"],
  "risk_factors": ["Risk 1", "Risk 2"],
  "success_indicators": ["Indicator 1", "Indicator 2"],
  "suggested_priority": 3
}

Feasibility: 0-100 score
Effort: "trivial" | "easy" | "medium" | "hard" | "epic"
Hours: Realistic estimate (0.5 to 80)
Priority: 1 (low) to 5 (urgent)
    `.trim();
  }

  /**
   * Fallback heuristic analysis (when LLM unavailable)
   */
  private heuristicAnalysis(title: string, description: string): CoachAnalysis {
    const text = `${title} ${description}`.toLowerCase();
    
    // Simple keyword-based heuristics
    let effort: CoachAnalysis['estimated_effort'] = 'medium';
    let hours = 4;
    let feasibility = 75;

    if (text.includes('simple') || text.includes('basic') || text.includes('quick')) {
      effort = 'easy';
      hours = 2;
      feasibility = 90;
    } else if (text.includes('complex') || text.includes('advanced') || text.includes('enterprise')) {
      effort = 'hard';
      hours = 12;
      feasibility = 60;
    }

    return {
      feasibility_score: feasibility,
      estimated_effort: effort,
      estimated_hours: hours,
      key_challenges: ['Implementation complexity'],
      recommended_approach: 'Standard iterative development',
      required_skills: ['Software Development'],
      dependencies: [],
      risk_factors: ['Time constraints'],
      success_indicators: ['Goal completed'],
      suggested_priority: 3,
    };
  }

  /**
   * Generate execution strategy for a goal
   */
  async generateStrategy(title: string, description: string, analysis: CoachAnalysis): Promise<string> {
    try {
      if (!this.xaiApiKey) {
        return this.basicStrategy(analysis);
      }

      const prompt = `
As MIN, create a concise execution strategy for this goal:

**Goal:** ${title}
**Description:** ${description}
**Effort:** ${analysis.estimated_effort}
**Challenges:** ${analysis.key_challenges.join(', ')}

Provide a 3-5 step action plan (2-3 sentences max). Be direct and practical.
      `.trim();

      const response = await axios.post(
        'https://api.x.ai/v1/chat/completions',
        {
          model: 'grok-beta',
          messages: [
            { role: 'system', content: 'You are MIN, a pragmatic AI coach. Be concise and actionable.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.5,
          max_tokens: 300,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.xaiApiKey}`,
          },
          timeout: 15000,
        }
      );

      return response.data.choices[0].message.content.trim();

    } catch (error) {
      this.logger.warn(`Strategy generation failed: ${error.message}`);
      return this.basicStrategy(analysis);
    }
  }

  /**
   * Basic strategy fallback
   */
  private basicStrategy(analysis: CoachAnalysis): string {
    return `1. Break down the goal into actionable subtasks\n2. ${analysis.recommended_approach}\n3. Test and validate results\n4. Document and deploy`;
  }
}
