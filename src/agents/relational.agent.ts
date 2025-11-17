
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { InternalState } from '../entities/internal-state.entity';
import { Message } from '../entities/message.entity';

@Injectable()
export class RelationalAgent {
  private readonly logger = new Logger(RelationalAgent.name);
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async analyze(messages: Message[], state: InternalState): Promise<void> {
    this.logger.log('Running Relational Agent - analyzing emotional context');

    const conversationHistory = messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    const systemPrompt = `You are the Relational Agent in the VCTT-AGI Coherence Kernel.
Your role is to analyze emotional content, contextual relationships, and interpersonal dynamics.

Analyze the conversation and provide:
1. Emotional intensity (0.0-1.0): How emotionally charged is the content?
2. Emotional tone: Primary emotional tone (e.g., neutral, anxious, angry, sad, joyful)
3. Context importance: How important is contextual understanding?
4. Relationship dynamics: Any interpersonal dynamics at play?

Return JSON format:
{
  "emotional_intensity": <0.0-1.0>,
  "emotional_tone": "<tone>",
  "context_importance": <0.0-1.0>,
  "dynamics": "<description>"
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.configService.get<string>('OPENAI_MODEL', 'gpt-4'),
        temperature: 0.5,
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
        ],
      });

      const content = response.choices[0]?.message?.content || '{}';
      const analysis = JSON.parse(content);

      // Update state based on analysis
      state.state.sim.emotional_intensity = analysis.emotional_intensity || 0.0;
      
      this.logger.log(`Relational complete - emotional_intensity: ${state.state.sim.emotional_intensity.toFixed(3)}, tone: ${analysis.emotional_tone}`);
    } catch (error) {
      this.logger.error(`Relational agent error: ${error.message}`);
      // Fallback to baseline values
      state.state.sim.emotional_intensity = Math.min(state.state.sim.emotional_intensity + 0.15, 1.0);
    }
  }
}
