
import { Injectable, Logger } from '@nestjs/common';
import { InternalState } from '../entities/internal-state.entity';
import { Message } from '../entities/message.entity';

/**
 * CAM - Contradiction Analysis Module
 * Detects contradictions in reasoning and triggers clarification mode
 */
@Injectable()
export class CAMModule {
  private readonly logger = new Logger(CAMModule.name);

  calculate(messages: Message[], state: InternalState): void {
    this.logger.log('Running CAM - detecting contradictions');

    // Analyze recent messages for contradictions
    const recentMessages = messages.slice(-6);
    const userMessages = recentMessages.filter(m => m.role === 'user');
    
    if (userMessages.length < 2) {
      state.state.contradiction = 0.0;
      this.logger.log('CAM complete - insufficient history, contradiction: 0.000');
      return;
    }

    // Simple contradiction detection based on negation patterns
    let contradictionScore = 0.0;
    const lastUserMsg = userMessages[userMessages.length - 1].content.toLowerCase();
    const prevUserMsgs = userMessages.slice(0, -1).map(m => m.content.toLowerCase());

    // Check for direct negations
    const negationPatterns = [
      { affirm: 'yes', negate: 'no' },
      { affirm: 'agree', negate: 'disagree' },
      { affirm: 'correct', negate: 'incorrect' },
      { affirm: 'right', negate: 'wrong' },
      { affirm: 'true', negate: 'false' },
    ];

    for (const pattern of negationPatterns) {
      const hasAffirmNow = lastUserMsg.includes(pattern.affirm);
      const hasNegateBefore = prevUserMsgs.some(m => m.includes(pattern.negate));
      const hasNegateNow = lastUserMsg.includes(pattern.negate);
      const hasAffirmBefore = prevUserMsgs.some(m => m.includes(pattern.affirm));

      if ((hasAffirmNow && hasNegateBefore) || (hasNegateNow && hasAffirmBefore)) {
        contradictionScore += 0.3;
      }
    }

    // Check for "but" or "however" indicating contradiction
    if (lastUserMsg.includes(' but ') || lastUserMsg.includes('however')) {
      contradictionScore += 0.2;
    }

    // High tension also suggests potential contradiction
    if (state.state.sim.tension > 0.7) {
      contradictionScore += 0.15;
    }

    // Clamp to [0.0, 1.0]
    state.state.contradiction = Math.min(contradictionScore, 1.0);

    // Trigger clarification mode if contradiction is high
    if (state.state.contradiction > 0.6) {
      state.state.regulation = 'clarify';
      this.logger.log(`CAM triggered CLARIFY mode - contradiction: ${state.state.contradiction.toFixed(3)}`);
    } else {
      this.logger.log(`CAM complete - contradiction: ${state.state.contradiction.toFixed(3)}`);
    }
  }
}
