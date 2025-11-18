
import { Injectable, Logger } from '@nestjs/common';
import { InternalState } from '../entities/internal-state.entity';
import { Message } from '../entities/message.entity';
import { LLMService } from '../services/llm.service';

/**
 * Analyst Agent - Analyzes logical structure and reasoning quality
 * 
 * Part of the VCTT-AGI Coherence Kernel
 * Role: Logical analysis, fallacy detection, reasoning quality assessment
 */
@Injectable()
export class AnalystAgent {
  private readonly logger = new Logger(AnalystAgent.name);

  constructor(private llmService: LLMService) {}

  async analyze(messages: Message[], state: InternalState): Promise<void> {
    this.logger.log('🔍 Analyst Agent - analyzing logical structure');

    const conversationHistory = messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    const systemPrompt = `You are the Analyst Agent in the VCTT-AGI Coherence Kernel.
Your role is to analyze logical structure, detect fallacies, and assess reasoning quality.

Analyze the conversation and provide:
1. **Logical complexity** (0.0-1.0): How complex is the reasoning?
2. **Fallacies detected**: List any logical fallacies (e.g., ad hominem, straw man, false dichotomy)
3. **Premises**: Extract key premises being argued
4. **Conclusions**: Extract stated or implied conclusions
5. **Tension level** (0.0-1.0): How much logical tension or contradiction exists?
   - 0.0 = Perfectly coherent, no tension
   - 0.5 = Moderate tension, some inconsistencies
   - 1.0 = High tension, significant contradictions

Return ONLY valid JSON (no markdown, no extra text):
{
  "logical_complexity": <0.0-1.0>,
  "fallacies": ["fallacy1", "fallacy2"],
  "premises": ["premise1", "premise2"],
  "conclusions": ["conclusion1"],
  "tension": <0.0-1.0>
}`;

    try {
      const response = await this.llmService.generateCompletion(
        conversationHistory,
        systemPrompt,
        0.3, // Low temperature for analytical consistency
      );

      let content = response.content.trim();
      
      // Remove markdown code blocks if present
      if (content.startsWith('```')) {
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      }

      const analysis = JSON.parse(content);

      // Update state based on analysis
      if (typeof analysis.tension === 'number') {
        state.state.sim.tension = Math.max(0, Math.min(1, analysis.tension));
      }
      
      this.logger.log(
        `✅ Analyst complete - tension: ${state.state.sim.tension.toFixed(3)}, ` +
        `fallacies: ${analysis.fallacies?.length || 0}, ` +
        `complexity: ${analysis.logical_complexity?.toFixed(2) || 'N/A'}, ` +
        `cost: $${response.cost.toFixed(4)}, ` +
        `latency: ${response.latencyMs}ms, ` +
        `model: ${response.model}`
      );
    } catch (error) {
      this.logger.error(`❌ Analyst agent error: ${error.message}`);
      // Fallback to baseline values
      state.state.sim.tension = Math.min(state.state.sim.tension + 0.1, 1.0);
      this.logger.warn(`⚠️ Using fallback tension: ${state.state.sim.tension.toFixed(3)}`);
    }
  }
}
