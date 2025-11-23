
import { Injectable, Logger } from '@nestjs/common';
import { SafetyStewardAgent } from '../agents/safety-steward.agent';
import { GoalService } from './goal.service';
import { MemoryService } from './memory.service';

export interface SystemStateContext {
  regulationMode: string;
  memoryEnabled: boolean;
  killSwitchActive: boolean;
  activeGoals: Array<{
    id: number;
    title: string;
    priority: number;
    owner: string;
    progressPercent?: number;
  }>;
  timestamp: string;
}

@Injectable()
export class StateInjectionService {
  private readonly logger = new Logger(StateInjectionService.name);

  constructor(
    private readonly safetySteward: SafetyStewardAgent,
    private readonly goalService: GoalService,
  ) {
    this.logger.log('🧠 State Injection Service initialized - MIN is now self-aware');
  }

  /**
   * Get current system state
   */
  async getSystemState(): Promise<SystemStateContext> {
    try {
      // Get regulation mode and kill switch status
      const mode = this.safetySteward.getMode();
      const killSwitchActive = this.safetySteward.getKillSwitchStatus().isActive;

      // Get memory status
      const memoryEnabled = process.env.MEMORY_PERSISTENCE_ENABLED === 'true';

      // Get active goals
      const activeGoals = await this.goalService.getActiveGoals();
      
      // Transform goals for context
      const goalsContext = activeGoals.map((goal) => {
        const latestProgress = goal.progress_entries?.[0];
        return {
          id: goal.id,
          title: goal.title,
          priority: goal.priority,
          owner: goal.owner,
          progressPercent: latestProgress?.progress_percent || 0,
        };
      });

      return {
        regulationMode: mode,
        memoryEnabled,
        killSwitchActive,
        activeGoals: goalsContext,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error getting system state:', error);
      // Return safe defaults if there's an error
      return {
        regulationMode: 'RESEARCH',
        memoryEnabled: false,
        killSwitchActive: false,
        activeGoals: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Build state awareness prompt injection
   * This is injected into every prompt to make MIN aware of its current state
   */
  async buildStateAwarenessPrompt(): Promise<string> {
    const state = await this.getSystemState();

    const lines = [
      '═══════════════════════════════════════════════════',
      '🧠 SYSTEM STATE AWARENESS (Current Context)',
      '═══════════════════════════════════════════════════',
      '',
      `📊 Regulation Mode: ${state.regulationMode}`,
    ];

    // Add mode explanation
    if (state.regulationMode === 'RESEARCH') {
      lines.push('   └─ ALL AGI features DISABLED (read-only mode)');
    } else if (state.regulationMode === 'DEVELOPMENT') {
      lines.push('   └─ Testing mode with verification (writes require confirmation)');
    } else if (state.regulationMode === 'AUTONOMOUS') {
      lines.push('   └─ ⚠️  FULL AGI ACTIVE (autonomous operations enabled)');
    } else if (state.regulationMode === 'EMERGENCY') {
      lines.push('   └─ 🚨 EMERGENCY MODE (all operations halted)');
    }

    lines.push('');
    lines.push(`💾 Persistent Memory: ${state.memoryEnabled ? 'ENABLED' : 'DISABLED'}`);
    
    if (state.memoryEnabled) {
      lines.push('   └─ Conversations and learned facts are being stored');
    } else {
      lines.push('   └─ Memory storage is disabled (ephemeral session only)');
    }

    lines.push('');
    lines.push(`🛡️  Kill Switch Status: ${state.killSwitchActive ? '🚨 ACTIVE (system halted)' : 'READY (inactive)'}`);

    if (state.killSwitchActive) {
      lines.push('   └─ ⚠️  All AGI operations are currently halted');
    } else {
      lines.push('   └─ Safety system is armed and monitoring');
    }

    lines.push('');
    lines.push(`🎯 Active Goals: ${state.activeGoals.length}`);

    if (state.activeGoals.length > 0) {
      state.activeGoals
        .sort((a, b) => b.priority - a.priority) // Sort by priority (highest first)
        .forEach((goal, index) => {
          const priorityEmoji = this.getPriorityEmoji(goal.priority);
          const ownerBadge = this.getOwnerBadge(goal.owner);
          lines.push(
            `   ${index + 1}. ${priorityEmoji} "${goal.title}" ${ownerBadge} [${goal.progressPercent}% complete]`,
          );
        });
    } else {
      lines.push('   └─ No active goals currently');
    }

    lines.push('');
    lines.push(`⏰ Timestamp: ${new Date(state.timestamp).toLocaleString()}`);
    lines.push('═══════════════════════════════════════════════════');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Build minimal state context (for API responses)
   */
  async buildMinimalStateContext(): Promise<string> {
    const state = await this.getSystemState();
    
    const parts = [
      `Mode: ${state.regulationMode}`,
      `Memory: ${state.memoryEnabled ? 'ON' : 'OFF'}`,
      `Active Goals: ${state.activeGoals.length}`,
    ];

    if (state.killSwitchActive) {
      parts.push('⚠️ KILL SWITCH ACTIVE');
    }

    return `[${parts.join(' | ')}]`;
  }

  /**
   * Check if MIN should be goal-aware (only in DEVELOPMENT or AUTONOMOUS modes)
   */
  isGoalAwarenessEnabled(): boolean {
    const mode = this.safetySteward.getMode();
    return mode === 'DEVELOPMENT' || mode === 'AUTONOMOUS';
  }

  /**
   * Get priority emoji
   */
  private getPriorityEmoji(priority: number): string {
    if (priority >= 5) return '🔴'; // Critical
    if (priority >= 4) return '🟠'; // High
    if (priority >= 3) return '🟡'; // Medium
    if (priority >= 2) return '🟢'; // Low
    return '⚪'; // Minimal
  }

  /**
   * Get owner badge
   */
  private getOwnerBadge(owner: string): string {
    if (owner === 'human') return '👤';
    if (owner === 'system') return '⚙️';
    if (owner === 'min') return '🤖';
    return '❓';
  }
}
