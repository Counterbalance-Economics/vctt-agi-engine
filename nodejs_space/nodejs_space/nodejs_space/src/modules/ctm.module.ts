
import { Injectable, Logger } from '@nestjs/common';
import { InternalState } from '../entities/internal-state.entity';

/**
 * CTM - Coherence Trust Metric
 * Calculates trust tau using the formula:
 * τ = 1 - (0.4 * tension + 0.3 * uncertainty + 0.3 * contradiction)
 */
@Injectable()
export class CTMModule {
  private readonly logger = new Logger(CTMModule.name);

  calculate(state: InternalState): void {
    this.logger.log('Running CTM - calculating trust metric');

    const { tension, uncertainty, emotional_intensity } = state.state.sim;
    const { contradiction } = state.state;

    // Exact formula from specification
    const trust_tau = 1.0 - (
      0.4 * tension +
      0.3 * uncertainty +
      0.3 * contradiction
    );

    // Clamp to [0.0, 1.0] (should already be in range, but ensure)
    state.state.trust_tau = Math.max(0.0, Math.min(1.0, trust_tau));

    this.logger.log(
      `CTM complete - τ: ${state.state.trust_tau.toFixed(3)} ` +
      `(T: ${tension.toFixed(3)}, U: ${uncertainty.toFixed(3)}, C: ${contradiction.toFixed(3)})`
    );
  }
}
