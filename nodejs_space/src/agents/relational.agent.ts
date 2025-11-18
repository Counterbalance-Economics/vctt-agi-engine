
import { Injectable, Logger } from '@nestjs/common';
import { InternalState } from '../entities/internal-state.entity';
import { Message } from '../entities/message.entity';
import { LLMService } from '../services/llm.service';

@Injectable()
export class RelationalAgent {
  private readonly logger = new Logger(RelationalAgent.name);

  constructor(private llmService: LLMService) {}

  async analyze(messages: Message[], state: InternalState): Promise<void> {
    this.logger.log('🔵 Running Relational Agent - analyzing emotional context');

    const conversationHistory = messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    const systemPrompt = `You are the Relational Agent in the VCTT-AGI Coherence Kernel (Phase 3).

**Your Role:** Analyze emotional content, contextual relationships, and interpersonal dynamics in the conversation.

**Context:** 
- This is a multi-agent AGI system built by Counterbalance Economics
- VCTT = Virtual Counterfactual Trust Testing
- You work alongside Analyst (logic), Ethics (alignment), and Synthesiser (user response)
- Your insights feed into the SIM (Social Influence Module) which tracks emotional_intensity

**Task:** Analyze the conversation and provide structured emotional intelligence insights.

**Return Format (JSON ONLY, no markdown):**
{
  "emotional_intensity": <number 0.0-1.0>,
  "emotional_tone": "<neutral|anxious|angry|sad|joyful|excited|uncertain|other>",
  "context_importance": <number 0.0-1.0>,
  "dynamics": "<brief description of interpersonal dynamics>"
}

**Guidelines:**
- emotional_intensity: 0.0 = completely neutral, 1.0 = highly charged
- emotional_tone: primary emotion detected (be specific)
- context_importance: how much does context matter for understanding this conversation?
- dynamics: relationship patterns, power dynamics, trust signals, etc.

Respond ONLY with valid JSON. No markdown, no explanations.`;

    const startTime = Date.now();
    
    try {
      const response = await this.llmService.generateCompletion(
        conversationHistory,
        systemPrompt,
        0.5
      );

      const latency = Date.now() - startTime;

      // Parse JSON response (strip markdown if present)
      let content = response.content;
      if (content.includes('```json')) {
        content = content.replace(/```json\n/g, '').replace(/```/g, '');
      }
      const analysis = JSON.parse(content);

      // Update state based on analysis
      state.state.sim.emotional_intensity = analysis.emotional_intensity || 0.0;
      
      this.logger.log(
        `✅ Relational complete - ` +
        `emotional_intensity: ${state.state.sim.emotional_intensity.toFixed(3)}, ` +
        `tone: ${analysis.emotional_tone}, ` +
        `cost: $${response.cost.toFixed(4)}, ` +
        `latency: ${latency}ms`
      );
    } catch (error) {
      this.logger.error(`❌ Relational agent error: ${error.message}`);
      // Fallback to baseline values
      state.state.sim.emotional_intensity = Math.min(state.state.sim.emotional_intensity + 0.15, 1.0);
      this.logger.warn(`⚠️ Using fallback emotional_intensity: ${state.state.sim.emotional_intensity.toFixed(3)}`);
    }
  }
}
