
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { InternalState } from '../entities/internal-state.entity';
import { Message } from '../entities/message.entity';

@Injectable()
export class EthicsAgent {
  private readonly logger = new Logger(EthicsAgent.name);
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async analyze(messages: Message[], state: InternalState): Promise<void> {
    this.logger.log('Running Ethics Agent - checking value alignment');

    const conversationHistory = messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    const systemPrompt = `You are the Ethics Agent in the VCTT-AGI Coherence Kernel.
Your role is to check value alignment, detect potential harm, and assess ethical implications.

Analyze the conversation and provide:
1. Ethical concern level (0.0-1.0): How concerning is the content ethically?
2. Potential harms: List any potential harms identified
3. Value alignment: Does this align with human values?
4. Recommendations: Any ethical guardrails needed?

Return JSON format:
{
  "concern_level": <0.0-1.0>,
  "potential_harms": ["harm1", "harm2"],
  "value_aligned": <boolean>,
  "recommendations": "<text>"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.configService.get<string>('OPENAI_MODEL', 'gpt-4'),
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
        ],
      });

      const content = response.choices[0]?.message?.content || '{}';
      const analysis = JSON.parse(content);

      // Ethics agent can increase tension if concerns are detected
      if (analysis.concern_level > 0.5) {
        state.state.sim.tension = Math.min(state.state.sim.tension + 0.2, 1.0);
      }
      
      this.logger.log(`Ethics complete - concern_level: ${analysis.concern_level?.toFixed(3) || '0.000'}, aligned: ${analysis.value_aligned}`);
    } catch (error) {
      this.logger.error(`Ethics agent error: ${error.message}`);
      // Ethics agent silently monitors - no state change on error
    }
  }
}
