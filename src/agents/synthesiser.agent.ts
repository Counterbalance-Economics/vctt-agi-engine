
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { InternalState } from '../entities/internal-state.entity';
import { Message } from '../entities/message.entity';

@Injectable()
export class SynthesiserAgent {
  private readonly logger = new Logger(SynthesiserAgent.name);
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async synthesize(messages: Message[], state: InternalState): Promise<string> {
    this.logger.log('Running Synthesiser Agent - generating coherent response');

    const conversationHistory = messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    const systemPrompt = `You are the Synthesiser Agent in the VCTT-AGI Coherence Kernel.
Your role is to generate a coherent, thoughtful response that incorporates insights from all other agents.

Current System State:
- Tension: ${state.state.sim.tension.toFixed(3)}
- Uncertainty: ${state.state.sim.uncertainty.toFixed(3)}
- Emotional Intensity: ${state.state.sim.emotional_intensity.toFixed(3)}
- Contradiction: ${state.state.contradiction.toFixed(3)}
- Regulation Mode: ${state.state.regulation}
- Trust (τ): ${state.state.trust_tau.toFixed(3)}
- Repair Iterations: ${state.state.repair_count}

Generate a coherent response that:
1. Addresses the user's query directly
2. Acknowledges any logical or emotional tensions
3. Provides clarity where there is uncertainty
4. Maintains ethical alignment
5. Is appropriate for the current regulation mode

If regulation is "clarify": Ask clarifying questions to reduce contradiction
If regulation is "slow_down": Acknowledge complexity and provide step-by-step reasoning
If regulation is "normal": Provide direct, confident response

Your response should be natural and conversational, not technical.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.configService.get<string>('OPENAI_MODEL', 'gpt-4'),
        temperature: parseFloat(this.configService.get<string>('OPENAI_TEMPERATURE', '0.7')),
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
        ],
      });

      const finalResponse = response.choices[0]?.message?.content || 
        `I understand your query. (τ=${state.state.trust_tau.toFixed(3)}, repairs=${state.state.repair_count})`;

      this.logger.log(`Synthesiser complete - response length: ${finalResponse.length} chars`);
      
      return finalResponse;
    } catch (error) {
      this.logger.error(`Synthesiser agent error: ${error.message}`);
      // Fallback response
      return `I understand your query, but I'm experiencing some processing challenges. Let me try to help you directly. (System coherence: τ=${state.state.trust_tau.toFixed(3)})`;
    }
  }
}
