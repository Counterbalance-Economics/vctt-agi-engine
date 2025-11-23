
import { Injectable, Logger } from '@nestjs/common';
import { InternalState } from '../entities/internal-state.entity';
import { Message } from '../entities/message.entity';

/**
 * SIM - System Intensity Monitor
 * Calculates tension, uncertainty, and emotional_intensity
 */
@Injectable()
export class SIMModule {
  private readonly logger = new Logger(SIMModule.name);

  calculate(messages: Message[], state: InternalState): void {
    this.logger.log('Running SIM - calculating system intensity metrics');

    // Tension is already updated by Analyst agent (based on logical complexity)
    // We can refine it here if needed
    
    // Calculate uncertainty based on message ambiguity and length variations
    const recentMessages = messages.slice(-5);
    const avgLength = recentMessages.reduce((sum, m) => sum + m.content.length, 0) / recentMessages.length;
    const lengthVariance = recentMessages.reduce((sum, m) => 
      sum + Math.pow(m.content.length - avgLength, 2), 0
    ) / recentMessages.length;
    
    // Normalize uncertainty (0.0 - 1.0)
    const baseUncertainty = Math.min(lengthVariance / 10000, 0.5);
    
    // Check for uncertainty keywords
    const lastMessage = messages[messages.length - 1]?.content.toLowerCase() || '';
    const uncertaintyKeywords = ['maybe', 'perhaps', 'unclear', 'not sure', 'uncertain', 'confused', 'ambiguous'];
    const keywordMatch = uncertaintyKeywords.some(kw => lastMessage.includes(kw));
    
    state.state.sim.uncertainty = keywordMatch ? 
      Math.min(baseUncertainty + 0.3, 1.0) : 
      baseUncertainty;

    // Emotional intensity is already updated by Relational agent
    // Ensure all values are clamped to [0.0, 1.0]
    state.state.sim.tension = Math.max(0.0, Math.min(1.0, state.state.sim.tension));
    state.state.sim.uncertainty = Math.max(0.0, Math.min(1.0, state.state.sim.uncertainty));
    state.state.sim.emotional_intensity = Math.max(0.0, Math.min(1.0, state.state.sim.emotional_intensity));

    this.logger.log(
      `SIM complete - T: ${state.state.sim.tension.toFixed(3)}, ` +
      `U: ${state.state.sim.uncertainty.toFixed(3)}, ` +
      `E: ${state.state.sim.emotional_intensity.toFixed(3)}`
    );
  }
}
