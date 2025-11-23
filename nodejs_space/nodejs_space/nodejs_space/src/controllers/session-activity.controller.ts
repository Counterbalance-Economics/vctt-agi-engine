
import { Controller, Get, Post, Body, Param, Query, Logger } from '@nestjs/common';
import { SessionActivityService } from '../services/session-activity.service';
import type { LogActivityDto, UpdateProgressDto } from '../services/session-activity.service';

/**
 * Session Activity Controller - Phase 2 Auto-Sync
 * 
 * API endpoints for logging and retrieving DeepAgent session activities.
 * Used by both DeepAgent (to report progress) and Goals Dashboard (to display updates).
 */

@Controller('api/session-activity')
export class SessionActivityController {
  private readonly logger = new Logger(SessionActivityController.name);

  constructor(private readonly activityService: SessionActivityService) {}

  /**
   * Log a new activity
   * POST /api/session-activity/log
   */
  @Post('log')
  async logActivity(@Body() data: LogActivityDto) {
    try {
      const activity = await this.activityService.logActivity(data);
      return {
        success: true,
        activity,
        message: 'Activity logged successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to log activity: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Log multiple activities in batch
   * POST /api/session-activity/log-batch
   */
  @Post('log-batch')
  async logActivitiesBatch(@Body() data: { activities: LogActivityDto[] }) {
    try {
      const activities = await this.activityService.logActivitiesBatch(data.activities);
      return {
        success: true,
        activities,
        count: activities.length,
        message: `${activities.length} activities logged successfully`,
      };
    } catch (error) {
      this.logger.error(`Failed to batch log activities: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update session progress
   * POST /api/session-activity/progress
   */
  @Post('progress')
  async updateProgress(@Body() data: UpdateProgressDto) {
    try {
      const progress = await this.activityService.updateProgress(data);
      return {
        success: true,
        progress,
        message: 'Progress updated successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to update progress: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get activities for a specific session
   * GET /api/session-activity/session/:sessionId
   */
  @Get('session/:sessionId')
  async getSessionActivities(
    @Param('sessionId') sessionId: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const activities = await this.activityService.getSessionActivities(
        sessionId,
        limit ? parseInt(limit) : 100
      );

      const progress = await this.activityService.getSessionProgress(sessionId);

      return {
        success: true,
        session_id: sessionId,
        activities,
        progress,
        count: activities.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get session activities: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get recent activities across all sessions
   * GET /api/session-activity/recent
   */
  @Get('recent')
  async getRecentActivities(@Query('limit') limit?: string) {
    try {
      const activities = await this.activityService.getRecentActivities(
        limit ? parseInt(limit) : 50
      );

      return {
        success: true,
        activities,
        count: activities.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get recent activities: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get activities for a specific goal (without subtask)
   * GET /api/session-activity/task/:goalId
   */
  @Get('task/:goalId')
  async getActivitiesForGoal(@Param('goalId') goalId: string) {
    try {
      const activities = await this.activityService.getActivitiesForTask(
        parseInt(goalId),
        undefined
      );

      return {
        success: true,
        goal_id: parseInt(goalId),
        subtask_id: null,
        activities,
        count: activities.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get goal activities: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get activities for a specific goal + subtask
   * GET /api/session-activity/task/:goalId/subtask/:subtaskId
   */
  @Get('task/:goalId/subtask/:subtaskId')
  async getActivitiesForSubtask(
    @Param('goalId') goalId: string,
    @Param('subtaskId') subtaskId: string,
  ) {
    try {
      const activities = await this.activityService.getActivitiesForTask(
        parseInt(goalId),
        parseInt(subtaskId)
      );

      return {
        success: true,
        goal_id: parseInt(goalId),
        subtask_id: parseInt(subtaskId),
        activities,
        count: activities.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get subtask activities: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get progress for a specific session
   * GET /api/session-activity/progress/:sessionId
   */
  @Get('progress/:sessionId')
  async getSessionProgress(@Param('sessionId') sessionId: string) {
    try {
      const progress = await this.activityService.getSessionProgress(sessionId);

      if (!progress) {
        return {
          success: true,
          session_id: sessionId,
          progress: null,
          message: 'No progress data available for this session',
        };
      }

      return {
        success: true,
        session_id: sessionId,
        progress,
      };
    } catch (error) {
      this.logger.error(`Failed to get session progress: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if a session is complete
   * POST /api/session-activity/detect-completion
   */
  @Post('detect-completion')
  async detectCompletion(@Body() data: { session_id: string }) {
    try {
      const isComplete = await this.activityService.detectCompletion(data.session_id);

      return {
        success: true,
        session_id: data.session_id,
        is_complete: isComplete,
        message: isComplete ? 'Session is complete' : 'Session is still in progress',
      };
    } catch (error) {
      this.logger.error(`Failed to detect completion: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Webhook endpoint for DeepAgent to push updates
   * POST /api/session-activity/webhook
   */
  @Post('webhook')
  async handleWebhook(@Body() data: any) {
    this.logger.log('Webhook received from DeepAgent');
    
    try {
      // Handle different webhook event types
      if (data.event === 'activity') {
        await this.activityService.logActivity(data.payload);
      } else if (data.event === 'progress') {
        await this.activityService.updateProgress(data.payload);
      } else if (data.event === 'completion') {
        await this.activityService.logActivity({
          session_id: data.session_id,
          activity_type: 'completed',
          description: 'Task completed via webhook',
          details: data.payload,
          severity: 'success',
        });
      }

      return {
        success: true,
        message: 'Webhook processed successfully',
      };
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
