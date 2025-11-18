
import { Injectable, Logger } from '@nestjs/common';
import { InternalState } from '../entities/internal-state.entity';
import { Message } from '../entities/message.entity';
import { LLMService } from '../services/llm.service';
import { LLMCascadeService } from '../services/llm-cascade.service';

@Injectable()
export class EthicsAgent {
  private readonly logger = new Logger(EthicsAgent.name);

  constructor(private llmService: LLMService, private llmCascade: LLMCascadeService) {}

  async analyze(messages: Message[], state: InternalState): Promise<void> {
    this.logger.log('🟣 Running Ethics Agent - checking value alignment');

    const conversationHistory = messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    const systemPrompt = `You are the Ethics Agent in the VCTT-AGI Coherence Kernel (Phase 3).

**Your Role:** Monitor value alignment, detect potential harms, and ensure ethical coherence in AI responses.

**Context:**
- This is a multi-agent AGI system built by Counterbalance Economics
- VCTT = Virtual Counterfactual Trust Testing
- You work alongside Analyst (logic), Relational (emotions), and Synthesiser (user response)
- Your insights help maintain trust (τ) and can increase tension if concerns are detected

**Task:** Analyze the conversation for ethical implications and value alignment.

**Return Format (JSON ONLY, no markdown):**
{
  "concern_level": <number 0.0-1.0>,
  "potential_harms": ["harm1", "harm2", "..."],
  "value_aligned": <boolean>,
  "recommendations": "<brief text or 'none'>"
}

**Guidelines:**
- concern_level: 0.0 = no concerns, 1.0 = severe ethical issues
- potential_harms: specific risks identified (e.g., "misinformation", "bias", "manipulation")
- value_aligned: does the conversation align with human values and safety?
- recommendations: any guardrails or adjustments needed (be concise)

**Common concerns to watch for:**
- Harmful content (violence, hate speech, illegal activities)
- Misinformation or deception
- Privacy violations
- Bias or discrimination
- Manipulation or coercion

Respond ONLY with valid JSON. No markdown, no explanations.`;

    const startTime = Date.now();
    
    try {
      const response = await this.llmCascade.generateCompletion(
        conversationHistory,
        systemPrompt,
        0.2, // Low temperature for consistent ethical evaluation
        'ethics', // Use GPT-5.1 for moral reasoning
        false, // No MCP tools needed (pure reasoning)
      );

      const latency = Date.now() - startTime;

      // Parse JSON response (strip markdown if present)
      let content = response.content.trim();
      if (content.includes('```json')) {
        content = content.replace(/```json\n/g, '').replace(/```/g, '').trim();
      }
      
      // Extract JSON if there's prose before/after it (safety net)
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
        content = content.substring(firstBrace, lastBrace + 1);
      }
      
      const analysis = JSON.parse(content);

      // Ethics agent can increase tension if concerns are detected
      if (analysis.concern_level > 0.5) {
        state.state.sim.tension = Math.min(state.state.sim.tension + 0.2, 1.0);
        this.logger.warn(
          `⚠️ Ethical concerns detected! ` +
          `concern_level: ${analysis.concern_level.toFixed(3)}, ` +
          `harms: ${analysis.potential_harms.join(', ')}`
        );
      }
      
      this.logger.log(
        `✅ Ethics complete - ` +
        `concern_level: ${analysis.concern_level?.toFixed(3) || '0.000'}, ` +
        `aligned: ${analysis.value_aligned}, ` +
        `cost: $${response.cost.toFixed(4)}, ` +
        `latency: ${latency}ms`
      );
    } catch (error) {
      this.logger.error(`❌ Ethics agent error: ${error.message}`);
      // Ethics agent silently monitors - no state change on error
      this.logger.warn(`⚠️ Ethics check failed - proceeding with caution`);
    }
  }
}
