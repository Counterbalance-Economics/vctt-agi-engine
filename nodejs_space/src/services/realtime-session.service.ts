
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * Real-Time Session Service - Phase 4
 * 
 * Interfaces with the DeepAgent API to spawn and manage autonomous sessions.
 * This is the bridge between MIN and actual execution.
 */

export interface RealTimeSession {
  session_id: string;
  status: 'initializing' | 'running' | 'completed' | 'failed';
  created_at: Date;
  goal_context: any;
  progress?: number;
  result?: any;
  error?: string;
}

@Injectable()
export class RealTimeSessionService {
  private readonly logger = new Logger(RealTimeSessionService.name);
  private readonly DEEPAGENT_API_BASE = process.env.DEEPAGENT_API_BASE || 'https://apps.abacus.ai/api/v0';
  
  // Track active sessions
  private activeSessions = new Map<string, RealTimeSession>();

  constructor() {
    this.logger.log('🚀 Real-Time Session Service initialized');
  }

  /**
   * Spawn a new DeepAgent session for a goal
   */
  async spawnSession(goalId: number, goalTitle: string, goalDescription: string): Promise<RealTimeSession> {
    try {
      this.logger.log(`🌱 Spawning DeepAgent session for goal ${goalId}: ${goalTitle}`);

      // Create the task prompt
      const taskPrompt = this.buildTaskPrompt(goalTitle, goalDescription);

      // Spawn session via internal API
      // Note: Using Abacus.AI's internal conversation/task API
      const response = await axios.post(
        `${this.DEEPAGENT_API_BASE}/createConversation`,
        {
          name: `MIN-AUTO: ${goalTitle}`,
          description: taskPrompt,
          appId: 'appllm_engineer', // DeepAgent app ID
          autoStart: true,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            // Auth will be handled by the platform automatically
          },
          timeout: 10000,
        }
      );

      const sessionId = response.data.conversationId || `session-${Date.now()}`;

      const session: RealTimeSession = {
        session_id: sessionId,
        status: 'initializing',
        created_at: new Date(),
        goal_context: {
          goal_id: goalId,
          title: goalTitle,
          description: goalDescription,
        },
      };

      this.activeSessions.set(sessionId, session);

      this.logger.log(`✅ DeepAgent session spawned: ${sessionId}`);

      return session;

    } catch (error) {
      this.logger.error(`❌ Failed to spawn DeepAgent session: ${error.message}`);
      
      // Determine mode based on available API keys
      const hasOpenAI = !!process.env.OPENAI_API_KEY;
      const hasAbacusAI = !!process.env.ABACUSAI_API_KEY;
      const mode = (hasOpenAI || hasAbacusAI) ? 'reality' : 'simulation';
      
      this.logger.log(`🎯 Creating fallback session in ${mode.toUpperCase()} mode (OpenAI: ${hasOpenAI}, AbacusAI: ${hasAbacusAI})`);
      
      // Fallback: Create a local session (reality or simulation based on API keys)
      const fallbackSession: RealTimeSession = {
        session_id: `fallback-${goalId}-${Date.now()}`,
        status: 'running',
        created_at: new Date(),
        goal_context: {
          goal_id: goalId,
          title: goalTitle,
          description: goalDescription,
          mode: mode,
        },
      };

      this.activeSessions.set(fallbackSession.session_id, fallbackSession);
      
      return fallbackSession;
    }
  }

  /**
   * Check session status
   */
  async getSessionStatus(sessionId: string): Promise<RealTimeSession | null> {
    // First check local cache
    if (this.activeSessions.has(sessionId)) {
      return this.activeSessions.get(sessionId)!;
    }

    try {
      // Query API for session status
      const response = await axios.get(
        `${this.DEEPAGENT_API_BASE}/getConversation`,
        {
          params: { conversationId: sessionId },
          timeout: 5000,
        }
      );

      if (response.data) {
        const session: RealTimeSession = {
          session_id: sessionId,
          status: this.mapApiStatusToSessionStatus(response.data.status),
          created_at: new Date(response.data.createdAt),
          goal_context: response.data.context,
          progress: response.data.progress,
        };

        this.activeSessions.set(sessionId, session);
        return session;
      }

    } catch (error) {
      this.logger.warn(`Failed to query session ${sessionId}: ${error.message}`);
    }

    return null;
  }

  /**
   * Send a message to a running session
   */
  async sendMessage(sessionId: string, message: string): Promise<boolean> {
    try {
      await axios.post(
        `${this.DEEPAGENT_API_BASE}/sendMessage`,
        {
          conversationId: sessionId,
          message: message,
        },
        {
          timeout: 5000,
        }
      );

      return true;
    } catch (error) {
      this.logger.error(`Failed to send message to session ${sessionId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Complete a session (for simulation mode)
   */
  async completeSession(sessionId: string, result: any): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = 'completed';
      session.result = result;
      this.activeSessions.set(sessionId, session);
    }
  }

  /**
   * Build task prompt for DeepAgent
   */
  private buildTaskPrompt(title: string, description: string): string {
    return `
# AUTONOMOUS TASK FROM MIN (VCTT-AGI Engine)

**Goal:** ${title}

**Description:**
${description}

**Instructions:**
- This is an autonomous execution spawned by MIN's orchestrator
- Complete the goal as specified
- Report progress and results
- Handle errors gracefully
- Optimize for efficiency

**Expected Outcome:**
Complete the goal successfully and report final status.
    `.trim();
  }

  /**
   * Map API status to session status
   */
  private mapApiStatusToSessionStatus(apiStatus: string): RealTimeSession['status'] {
    const statusMap: Record<string, RealTimeSession['status']> = {
      'pending': 'initializing',
      'running': 'running',
      'active': 'running',
      'completed': 'completed',
      'success': 'completed',
      'failed': 'failed',
      'error': 'failed',
    };

    return statusMap[apiStatus?.toLowerCase()] || 'running';
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): RealTimeSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Clean up old sessions
   */
  cleanupOldSessions(maxAgeHours: number = 24): void {
    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.created_at < cutoff && session.status !== 'running') {
        this.activeSessions.delete(sessionId);
        this.logger.debug(`🧹 Cleaned up old session: ${sessionId}`);
      }
    }
  }
}
