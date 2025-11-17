
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { InternalState } from '../entities/internal-state.entity';
import { Message } from '../entities/message.entity';

@Injectable()
export class SynthesiserAgent {
  private readonly logger = new Logger(SynthesiserAgent.name);
  private openai: OpenAI;
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY_MS = 1000;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async callOpenAIWithRetry(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    attempt: number = 1
  ): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.configService.get<string>('OPENAI_MODEL', 'gpt-4'),
        temperature: parseFloat(this.configService.get<string>('OPENAI_TEMPERATURE', '0.7')),
        max_tokens: parseInt(this.configService.get<string>('OPENAI_MAX_TOKENS', '2000'), 10),
        messages,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error: any) {
      const isRateLimit = error.status === 429 || error.code === 'rate_limit_exceeded';
      const isServerError = error.status >= 500 && error.status < 600;
      const shouldRetry = (isRateLimit || isServerError) && attempt < this.MAX_RETRIES;

      if (shouldRetry) {
        const delayMs = this.BASE_DELAY_MS * Math.pow(2, attempt - 1);
        this.logger.warn(
          `OpenAI ${error.status || error.code} error on attempt ${attempt}/${this.MAX_RETRIES}. ` +
          `Retrying in ${delayMs}ms...`
        );
        await this.sleep(delayMs);
        return this.callOpenAIWithRetry(messages, attempt + 1);
      }

      // Max retries exceeded or non-retryable error
      this.logger.error(
        `OpenAI API error after ${attempt} attempts: ${error.message} (status: ${error.status || 'unknown'})`
      );
      throw error;
    }
  }

  async synthesize(messages: Message[], state: InternalState): Promise<string> {
    this.logger.log('Running Synthesiser Agent - generating coherent response');

    const conversationHistory = messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    const systemPrompt = `You are the Synthesiser Agent in the VCTT-AGI Coherence Kernel.
Your role is to generate a coherent, thoughtful, and COMPREHENSIVE response that incorporates insights from all other agents.

Current System State:
- Tension: ${state.state.sim.tension.toFixed(3)}
- Uncertainty: ${state.state.sim.uncertainty.toFixed(3)}
- Emotional Intensity: ${state.state.sim.emotional_intensity.toFixed(3)}
- Contradiction: ${state.state.contradiction.toFixed(3)}
- Regulation Mode: ${state.state.regulation}
- Trust (τ): ${state.state.trust_tau.toFixed(3)}
- Repair Iterations: ${state.state.repair_count}

Generate a coherent response that:
1. Addresses the user's query directly and COMPLETELY
2. Acknowledges any logical or emotional tensions
3. Provides clarity where there is uncertainty
4. Maintains ethical alignment
5. Is appropriate for the current regulation mode

If regulation is "clarify": Ask clarifying questions to reduce contradiction
If regulation is "slow_down": Acknowledge complexity and provide step-by-step reasoning with full explanations
If regulation is "normal": Provide direct, confident, and THOROUGH response

IMPORTANT: Provide full, complete thoughts. Don't cut your response short. Aim for 3-5 paragraphs of rich, detailed reasoning.
Your response should be natural and conversational, not technical, but comprehensive and complete.`;

    try {
      const content = await this.callOpenAIWithRetry([
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
      ]);

      const finalResponse = content || 
        `I understand your query. (τ=${state.state.trust_tau.toFixed(3)}, repairs=${state.state.repair_count})`;

      this.logger.log(`Synthesiser complete - response length: ${finalResponse.length} chars`);
      
      return finalResponse;
    } catch (error: any) {
      // Graceful degradation with informative message
      const errorType = error.status === 429 ? 'rate limit' : 
                        error.status >= 500 ? 'service error' : 
                        'processing error';
      
      this.logger.error(`Synthesiser agent ${errorType} after ${this.MAX_RETRIES} retries: ${error.message}`);
      
      // Return a helpful fallback that doesn't break the conversation
      return `I understand your query, but I'm experiencing ${errorType} issues with my reasoning engine. ` +
             `This is temporary - please try again in a moment. ` +
             `(System coherence: τ=${state.state.trust_tau.toFixed(3)}, regulation: ${state.state.regulation})`;
    }
  }
}
