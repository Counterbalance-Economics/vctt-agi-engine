
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { InternalState } from '../entities/internal-state.entity';
import { Message } from '../entities/message.entity';

@Injectable()
export class AnalystAgent {
  private readonly logger = new Logger(AnalystAgent.name);
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
  }

  async analyze(messages: Message[], state: InternalState): Promise<void> {
    this.logger.log('Running Analyst Agent - analyzing logical structure');

    const conversationHistory = messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    const systemPrompt = `You are the Analyst Agent in the VCTT-AGI Coherence Kernel.
Your role is to analyze logical structure, detect fallacies, and assess reasoning quality.

Analyze the conversation and provide:
1. Logical complexity (0.0-1.0): How complex is the reasoning?
2. Fallacies detected: List any logical fallacies
3. Premises and conclusions: Extract key logical elements
4. Tension level (0.0-1.0): How much logical tension exists?

Return JSON format:
{
  "logical_complexity": <0.0-1.0>,
  "fallacies": ["fallacy1", "fallacy2"],
  "premises": ["premise1", "premise2"],
  "conclusions": ["conclusion1"],
  "tension": <0.0-1.0>
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.configService.get<string>('OPENAI_MODEL', 'gpt-4'),
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
        ],
      });

      const content = response.choices[0]?.message?.content || '{}';
      const analysis = JSON.parse(content);

      // Update state based on analysis
      state.state.sim.tension = analysis.tension || 0.0;
      
      this.logger.log(`Analyst complete - tension: ${state.state.sim.tension.toFixed(3)}, fallacies: ${analysis.fallacies?.length || 0}`);
    } catch (error) {
      this.logger.error(`Analyst agent error: ${error.message}`);
      // Fallback to baseline values
      state.state.sim.tension = Math.min(state.state.sim.tension + 0.1, 1.0);
    }
  }
}
