
import { Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';

/**
 * Session Activity Service - Phase 2 Auto-Sync
 * 
 * Handles real-time activity logging and progress tracking for DeepAgent sessions.
 * This enables the Goals Dashboard to show live updates of MIN's work.
 */

export interface SessionActivity {
  id: number;
  session_id: string;
  activity_type: string;
  description: string;
  details: any;
  severity: 'info' | 'success' | 'warning' | 'error';
  created_at: Date;
}

export interface SessionProgress {
  session_id: string;
  current_phase: string;
  progress_percent: number;
  files_modified: number;
  commands_run: number;
  errors_encountered: number;
  last_activity: string;
  last_activity_at: Date;
  estimated_completion?: Date;
  updated_at: Date;
}

export interface LogActivityDto {
  session_id: string;
  activity_type: 'session_started' | 'file_created' | 'file_edited' | 'file_deleted' | 
                 'command_run' | 'api_call' | 'error' | 'warning' | 'progress_update' | 
                 'checkpoint' | 'completed' | 'failed';
  description: string;
  details?: any;
  severity?: 'info' | 'success' | 'warning' | 'error';
}

export interface UpdateProgressDto {
  session_id: string;
  current_phase?: string;
  progress_percent?: number;
  files_modified?: number;
  commands_run?: number;
  errors_encountered?: number;
  last_activity?: string;
  estimated_completion?: Date;
}

@Injectable()
export class SessionActivityService {
  private readonly logger = new Logger(SessionActivityService.name);
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });
  }

  /**
   * Log a new activity for a DeepAgent session
   */
  async logActivity(data: LogActivityDto): Promise<SessionActivity> {
    const { session_id, activity_type, description, details = {}, severity = 'info' } = data;

    try {
      const result = await this.pool.query(
        `INSERT INTO session_activities 
         (session_id, activity_type, description, details, severity)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [session_id, activity_type, description, JSON.stringify(details), severity]
      );

      const activity = result.rows[0];
      this.logger.log(`Activity logged for session ${session_id}: ${activity_type}`);

      // Also update session progress
      await this.updateProgress({
        session_id,
        last_activity: description,
      });

      // Check for completion
      if (activity_type === 'completed') {
        await this.markSessionCompleted(session_id);
      }

      return activity;
    } catch (error) {
      this.logger.error(`Failed to log activity: ${error.message}`);
      throw error;
    }
  }

  /**
   * Log multiple activities in batch (for efficiency)
   */
  async logActivitiesBatch(activities: LogActivityDto[]): Promise<SessionActivity[]> {
    if (activities.length === 0) return [];

    try {
      const values = activities.map((a, i) => {
        const offset = i * 5;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
      }).join(', ');

      const params = activities.flatMap(a => [
        a.session_id,
        a.activity_type,
        a.description,
        JSON.stringify(a.details || {}),
        a.severity || 'info'
      ]);

      const result = await this.pool.query(
        `INSERT INTO session_activities 
         (session_id, activity_type, description, details, severity)
         VALUES ${values}
         RETURNING *`,
        params
      );

      this.logger.log(`Batch logged ${activities.length} activities`);
      return result.rows;
    } catch (error) {
      this.logger.error(`Failed to batch log activities: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update session progress
   */
  async updateProgress(data: UpdateProgressDto): Promise<SessionProgress> {
    const {
      session_id,
      current_phase,
      progress_percent,
      files_modified,
      commands_run,
      errors_encountered,
      last_activity,
      estimated_completion
    } = data;

    try {
      // Upsert progress record
      const setClauses = [];
      const values: any[] = [session_id];
      let paramIndex = 2;

      if (current_phase !== undefined) {
        setClauses.push(`current_phase = $${paramIndex++}`);
        values.push(current_phase);
      }
      if (progress_percent !== undefined) {
        setClauses.push(`progress_percent = $${paramIndex++}`);
        values.push(progress_percent);
      }
      if (files_modified !== undefined) {
        setClauses.push(`files_modified = $${paramIndex++}`);
        values.push(files_modified);
      }
      if (commands_run !== undefined) {
        setClauses.push(`commands_run = $${paramIndex++}`);
        values.push(commands_run);
      }
      if (errors_encountered !== undefined) {
        setClauses.push(`errors_encountered = $${paramIndex++}`);
        values.push(errors_encountered);
      }
      if (last_activity !== undefined) {
        setClauses.push(`last_activity = $${paramIndex++}, last_activity_at = NOW()`);
        values.push(last_activity);
      }
      if (estimated_completion !== undefined) {
        setClauses.push(`estimated_completion = $${paramIndex++}`);
        values.push(estimated_completion);
      }

      setClauses.push('updated_at = NOW()');

      const query = `
        INSERT INTO session_progress (session_id${setClauses.length > 0 ? ', ' + setClauses.join(', ').replace(/\s*=\s*\$\d+/g, '') : ''})
        VALUES ($1${setClauses.length > 0 ? ', ' + values.slice(1).map((_, i) => `$${i + 2}`).join(', ') : ''})
        ON CONFLICT (session_id)
        DO UPDATE SET ${setClauses.join(', ')}
        RETURNING *
      `;

      // Simplified query
      const simpleQuery = `
        INSERT INTO session_progress (session_id)
        VALUES ($1)
        ON CONFLICT (session_id)
        DO UPDATE SET
          ${setClauses.join(', ')}
        RETURNING *
      `;

      const result = await this.pool.query(simpleQuery, values);
      return result.rows[0];
    } catch (error) {
      this.logger.error(`Failed to update progress: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all activities for a session
   */
  async getSessionActivities(sessionId: string, limit = 100): Promise<SessionActivity[]> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM session_activities
         WHERE session_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [sessionId, limit]
      );

      return result.rows;
    } catch (error) {
      this.logger.error(`Failed to get session activities: ${error.message}`);
      return [];
    }
  }

  /**
   * Get session progress
   */
  async getSessionProgress(sessionId: string): Promise<SessionProgress | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM session_progress WHERE session_id = $1',
        [sessionId]
      );

      return result.rows[0] || null;
    } catch (error) {
      this.logger.error(`Failed to get session progress: ${error.message}`);
      return null;
    }
  }

  /**
   * Get recent activities across all sessions (for activity feed)
   */
  async getRecentActivities(limit = 50): Promise<SessionActivity[]> {
    try {
      const result = await this.pool.query(
        `SELECT sa.*, ds.goal_id, ds.subtask_id, ds.task_title
         FROM session_activities sa
         JOIN deepagent_sessions ds ON sa.session_id = ds.session_id
         ORDER BY sa.created_at DESC
         LIMIT $1`,
        [limit]
      );

      return result.rows;
    } catch (error) {
      this.logger.error(`Failed to get recent activities: ${error.message}`);
      return [];
    }
  }

  /**
   * Get activities for a specific goal/subtask
   */
  async getActivitiesForTask(goalId: number, subtaskId?: number): Promise<SessionActivity[]> {
    try {
      const query = subtaskId
        ? `SELECT sa.* FROM session_activities sa
           JOIN deepagent_sessions ds ON sa.session_id = ds.session_id
           WHERE ds.goal_id = $1 AND ds.subtask_id = $2
           ORDER BY sa.created_at DESC`
        : `SELECT sa.* FROM session_activities sa
           JOIN deepagent_sessions ds ON sa.session_id = ds.session_id
           WHERE ds.goal_id = $1
           ORDER BY sa.created_at DESC`;

      const params = subtaskId ? [goalId, subtaskId] : [goalId];
      const result = await this.pool.query(query, params);

      return result.rows;
    } catch (error) {
      this.logger.error(`Failed to get activities for task: ${error.message}`);
      return [];
    }
  }

  /**
   * Mark session as completed
   */
  private async markSessionCompleted(sessionId: string): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE deepagent_sessions
         SET status = 'completed', completion_detected_at = NOW(), updated_at = NOW()
         WHERE session_id = $1`,
        [sessionId]
      );

      await this.updateProgress({
        session_id: sessionId,
        progress_percent: 100,
        current_phase: 'completed',
      });

      this.logger.log(`Session ${sessionId} marked as completed`);
    } catch (error) {
      this.logger.error(`Failed to mark session completed: ${error.message}`);
    }
  }

  /**
   * Auto-detect completion based on activity patterns
   */
  async detectCompletion(sessionId: string): Promise<boolean> {
    try {
      // Get recent activities
      const activities = await this.getSessionActivities(sessionId, 10);

      // Check for completion indicators
      const hasCompletionActivity = activities.some(
        a => a.activity_type === 'completed' || a.activity_type === 'checkpoint'
      );

      const hasNoRecentErrors = !activities.slice(0, 5).some(
        a => a.severity === 'error'
      );

      const progress = await this.getSessionProgress(sessionId);
      const isHighProgress = progress && progress.progress_percent >= 95;

      if (hasCompletionActivity && hasNoRecentErrors) {
        await this.markSessionCompleted(sessionId);
        return true;
      }

      if (isHighProgress && hasNoRecentErrors) {
        // Tentatively mark as completed
        await this.logActivity({
          session_id: sessionId,
          activity_type: 'completed',
          description: 'Task appears to be completed (auto-detected)',
          severity: 'success',
        });
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to detect completion: ${error.message}`);
      return false;
    }
  }
}
