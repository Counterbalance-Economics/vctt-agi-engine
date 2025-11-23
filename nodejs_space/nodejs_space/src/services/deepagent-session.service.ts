
import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { v4 as uuidv4 } from 'uuid';

export interface CreateDeepAgentSessionDto {
  goalId?: number;
  subtaskId?: number;
  initiatedBy: string; // 'human' | 'min' | 'system'
  context: {
    title: string;
    description: string;
    requirements?: string[];
    files?: string[];
    additionalContext?: any;
  };
}

export interface UpdateDeepAgentSessionDto {
  status?: 'in_progress' | 'completed' | 'failed' | 'cancelled';
  result?: any;
  errorMessage?: string;
  metadata?: any;
}

@Injectable()
export class DeepAgentSessionService {
  private readonly logger = new Logger(DeepAgentSessionService.name);

  constructor(private readonly prisma: PrismaService) {
    this.logger.log('🔌 DeepAgent Session Service initialized');
  }

  /**
   * Create a new DeepAgent session
   */
  async createSession(dto: CreateDeepAgentSessionDto): Promise<any> {
    try {
      const sessionUuid = uuidv4();
      
      // Validate that either goalId or subtaskId is provided
      if (!dto.goalId && !dto.subtaskId) {
        throw new HttpException(
          'Either goalId or subtaskId must be provided',
          HttpStatus.BAD_REQUEST,
        );
      }

      // If subtaskId is provided, get the goal_id
      let goalId = dto.goalId;
      if (dto.subtaskId && !goalId) {
        const subtask: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT goal_id FROM goal_subtasks WHERE id = $1`,
          dto.subtaskId
        );
        
        if (subtask && subtask.length > 0) {
          goalId = subtask[0].goal_id;
        }
      }

      // Create session
      const result: any[] = await this.prisma.$queryRawUnsafe(
        `INSERT INTO deepagent_sessions 
          (session_uuid, goal_id, subtask_id, status, context, initiated_by)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6)
        RETURNING *`,
        sessionUuid,
        goalId || null,
        dto.subtaskId || null,
        'created',
        JSON.stringify(dto.context),
        dto.initiatedBy
      );

      const session = result[0];

      // Log activity
      await this.logActivity(session.id, 'created', 'DeepAgent session created', {
        initiated_by: dto.initiatedBy,
        context_title: dto.context.title,
      });

      // Also add to goal_activity_logs
      if (goalId) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO goal_activity_logs 
            (goal_id, activity_type, message, actor, metadata)
          VALUES ($1, $2, $3, $4, $5::jsonb)`,
          goalId,
          'deepagent_session_created',
          `Created DeepAgent session for: ${dto.context.title}`,
          dto.initiatedBy,
          JSON.stringify({ session_uuid: sessionUuid })
        );
      }

      this.logger.log(`✅ Created DeepAgent session ${sessionUuid}`);
      return this.formatSession(session);
    } catch (error) {
      this.logger.error(`❌ Failed to create DeepAgent session: ${error.message}`);
      throw new HttpException(
        `Failed to create DeepAgent session: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get session by ID or UUID
   */
  async getSession(identifier: string | number): Promise<any> {
    try {
      let session: any;
      
      if (typeof identifier === 'number') {
        const result: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT * FROM deepagent_sessions WHERE id = $1`,
          identifier
        );
        session = result[0];
      } else {
        const result: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT * FROM deepagent_sessions WHERE session_uuid = $1`,
          identifier
        );
        session = result[0];
      }

      if (!session) {
        throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
      }

      // Get activities
      const activities: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT * FROM deepagent_session_activities 
        WHERE session_id = $1 
        ORDER BY timestamp DESC`,
        session.id
      );

      return this.formatSession(session, activities);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      
      this.logger.error(`❌ Failed to get session: ${error.message}`);
      throw new HttpException(
        `Failed to get session: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update session (mark in progress, completed, etc.)
   */
  async updateSession(identifier: string | number, dto: UpdateDeepAgentSessionDto): Promise<any> {
    try {
      // Get current session
      const current = await this.getSession(identifier);
      
      // Build update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (dto.status) {
        updates.push(`status = $${paramIndex++}`);
        values.push(dto.status);
        
        // Set timestamps based on status
        if (dto.status === 'in_progress' && !current.started_at) {
          updates.push(`started_at = CURRENT_TIMESTAMP`);
        }
        if (['completed', 'failed', 'cancelled'].includes(dto.status)) {
          updates.push(`completed_at = CURRENT_TIMESTAMP`);
        }
      }

      if (dto.result) {
        updates.push(`result = $${paramIndex++}::jsonb`);
        values.push(JSON.stringify(dto.result));
      }

      if (dto.errorMessage) {
        updates.push(`error_message = $${paramIndex++}`);
        values.push(dto.errorMessage);
      }

      if (dto.metadata) {
        updates.push(`metadata = $${paramIndex++}::jsonb`);
        values.push(JSON.stringify(dto.metadata));
      }

      if (updates.length === 0) {
        return current; // No updates
      }

      // Add identifier to values
      values.push(current.id);

      // Execute update
      const query = `
        UPDATE deepagent_sessions 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result: any[] = await this.prisma.$queryRawUnsafe(query, ...values);
      const updated = result[0];

      // Log activity
      const activityDesc = dto.status 
        ? `Session status changed to ${dto.status}`
        : 'Session updated';
      
      await this.logActivity(current.id, dto.status || 'updated', activityDesc, {
        previous_status: current.status,
        new_status: dto.status,
      });

      // Also add to goal_activity_logs
      if (current.goal_id && dto.status) {
        let description = '';
        if (dto.status === 'in_progress') {
          description = 'Started working in DeepAgent';
        } else if (dto.status === 'completed') {
          description = 'Completed DeepAgent session';
        } else if (dto.status === 'failed') {
          description = `DeepAgent session failed: ${dto.errorMessage || 'Unknown error'}`;
        }

        await this.prisma.$executeRawUnsafe(
          `INSERT INTO goal_activity_logs 
            (goal_id, activity_type, message, actor, metadata)
          VALUES ($1, $2, $3, $4, $5::jsonb)`,
          current.goal_id,
          `deepagent_session_${dto.status}`,
          description,
          current.initiated_by,
          JSON.stringify({ session_uuid: current.session_uuid })
        );
      }

      this.logger.log(`✅ Updated DeepAgent session ${current.session_uuid}: ${dto.status || 'updated'}`);
      return this.formatSession(updated);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      
      this.logger.error(`❌ Failed to update session: ${error.message}`);
      throw new HttpException(
        `Failed to update session: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get all sessions for a goal
   */
  async getSessionsForGoal(goalId: number): Promise<any[]> {
    try {
      const sessions: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT * FROM deepagent_sessions 
        WHERE goal_id = $1 
        ORDER BY created_at DESC`,
        goalId
      );

      return sessions.map((s: any) => this.formatSession(s));
    } catch (error) {
      this.logger.error(`❌ Failed to get sessions for goal: ${error.message}`);
      throw new HttpException(
        `Failed to get sessions for goal: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get all sessions for a subtask
   */
  async getSessionsForSubtask(subtaskId: number): Promise<any[]> {
    try {
      const sessions: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT * FROM deepagent_sessions 
        WHERE subtask_id = $1 
        ORDER BY created_at DESC`,
        subtaskId
      );

      return sessions.map((s: any) => this.formatSession(s));
    } catch (error) {
      this.logger.error(`❌ Failed to get sessions for subtask: ${error.message}`);
      throw new HttpException(
        `Failed to get sessions for subtask: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Log activity for a session
   */
  private async logActivity(
    sessionId: number,
    activityType: string,
    description: string,
    metadata?: any,
  ): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO deepagent_session_activities 
          (session_id, activity_type, description, metadata)
        VALUES ($1, $2, $3, $4::jsonb)`,
        sessionId,
        activityType,
        description,
        metadata ? JSON.stringify(metadata) : null
      );
    } catch (error: any) {
      // Log but don't throw - activity logging shouldn't break main flow
      this.logger.warn(`⚠️ Failed to log session activity: ${error.message}`);
    }
  }

  /**
   * Format session for API response
   */
  private formatSession(session: any, activities?: any[]): any {
    return {
      id: session.id,
      sessionUuid: session.session_uuid,
      goalId: session.goal_id,
      subtaskId: session.subtask_id,
      status: session.status,
      context: typeof session.context === 'string' 
        ? JSON.parse(session.context) 
        : session.context,
      result: session.result 
        ? (typeof session.result === 'string' ? JSON.parse(session.result) : session.result)
        : null,
      initiatedBy: session.initiated_by,
      deepAgentUrl: session.deep_agent_url,
      errorMessage: session.error_message,
      createdAt: session.created_at,
      startedAt: session.started_at,
      completedAt: session.completed_at,
      updatedAt: session.updated_at,
      metadata: session.metadata 
        ? (typeof session.metadata === 'string' ? JSON.parse(session.metadata) : session.metadata)
        : null,
      activities: activities || [],
    };
  }
}
