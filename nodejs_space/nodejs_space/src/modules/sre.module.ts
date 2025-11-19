
import { Injectable, Logger } from '@nestjs/common';
import { InternalState } from '../entities/internal-state.entity';

/**
 * SRE - Self-Regulation Engine
 * Determines regulation mode based on tension and contradiction thresholds
 */
@Injectable()
export class SREModule {
  private readonly logger = new Logger(SREModule.name);

  calculate(state: InternalState): void {
    this.logger.log('Running SRE - determining regulation mode');

    const { tension, uncertainty, emotional_intensity } = state.state.sim;
    const { contradiction } = state.state;

    // Check thresholds for slow_down mode
    if (tension > 0.7 || contradiction > 0.7) {
      state.state.regulation = 'slow_down';
      this.logger.log(
        `SRE set SLOW_DOWN mode - T: ${tension.toFixed(3)}, C: ${contradiction.toFixed(3)}`
      );
      return;
    }

    // CAM may have already set clarify mode
    if (state.state.regulation === 'clarify') {
      this.logger.log('SRE maintains CLARIFY mode (set by CAM)');
      return;
    }

    // Check for moderate tension/uncertainty requiring clarification
    if (tension > 0.5 && uncertainty > 0.5) {
      state.state.regulation = 'clarify';
      this.logger.log(
        `SRE set CLARIFY mode - T: ${tension.toFixed(3)}, U: ${uncertainty.toFixed(3)}`
      );
      return;
    }

    // Default to normal mode
    state.state.regulation = 'normal';
    this.logger.log('SRE set NORMAL mode');
  }
}
