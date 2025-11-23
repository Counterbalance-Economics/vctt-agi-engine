
/**
 * SchedulerController - REST API for autonomous task scheduling
 * 
 * STAGE 4: Enables MIN to schedule, approve, and manage deferred/periodic/reminder tasks
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsBoolean, IsISO8601, Min, Max } from 'class-validator';
import { SchedulerService, ScheduleTaskDto } from '../services/scheduler.service';
import { BypassRegulation } from '../guards/regulation.guard';

// DTOs
class ScheduleTaskRequestDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  task_type: 'deferred' | 'periodic' | 'reminder';

  @IsOptional()
  @IsISO8601()
  scheduled_at?: string; // ISO 8601 datetime

  @IsOptional()
  @IsString()
  cron_expression?: string; // e.g., "0 3 * * *" for 3 AM daily

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number;

  @IsString()
  tool_name: string;

  tool_params: any;

  @IsInt()
  goal_id: number;

  @IsString()
  created_by: string;

  @IsOptional()
  @IsBoolean()
  requires_approval?: boolean;
}

class ApproveTaskDto {
  @IsString()
  approved_by: string;
}

class CancelTaskDto {
  @IsString()
  cancelled_by: string;
}

@Controller('api/scheduler')
@ApiTags('Scheduler')
export class SchedulerController {
  private readonly logger = new Logger(SchedulerController.name);

  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('schedule')
  @BypassRegulation() // Has its own internal mode checks
  @ApiOperation({
    summary: 'Schedule a new autonomous task',
    description: `Schedule a deferred, periodic, or reminder task linked to an approved goal.
    
    **Task Types:**
    - **deferred**: Run once at a specific time ("run tests in 10 minutes")
    - **periodic**: Run repeatedly on a schedule ("re-index every night at 3 AM")
    - **reminder**: Single reminder at a specific time ("follow up tomorrow")
    
    **Requirements:**
    - Must be linked to an ACTIVE goal
    - Blocked in RESEARCH mode (read-only)
    - Sensitive tools require human approval before execution
    
    **Cron Expression Examples:**
    - "*/5 * * * *" = Every 5 minutes
    - "0 3 * * *" = Every day at 3 AM
    - "0 0 * * 0" = Every Sunday at midnight
    - "0 9-17 * * 1-5" = Every hour 9 AM-5 PM, Monday-Friday`,
  })
  @ApiBody({ type: ScheduleTaskRequestDto })
  @ApiResponse({ status: 200, description: 'Task scheduled successfully' })
  @ApiResponse({ status: 403, description: 'Task scheduling blocked (RESEARCH mode or invalid goal)' })
  async scheduleTask(@Body() dto: ScheduleTaskRequestDto) {
    try {
      this.logger.log(`📅 Schedule task request: "${dto.title}"`);

      const scheduleDto: ScheduleTaskDto = {
        ...dto,
        scheduled_at: dto.scheduled_at ? new Date(dto.scheduled_at) : undefined,
      };

      return await this.schedulerService.scheduleTask(scheduleDto);
    } catch (error) {
      this.logger.error(`❌ Schedule task failed: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Put('approve/:id')
  @BypassRegulation()
  @ApiOperation({
    summary: 'Approve a pending task (human only)',
    description: 'Approve a task that requires human approval before execution',
  })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiBody({ type: ApproveTaskDto })
  @ApiResponse({ status: 200, description: 'Task approved' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async approveTask(@Param('id') id: string, @Body() dto: ApproveTaskDto) {
    try {
      this.logger.log(`✅ Approve task #${id} by ${dto.approved_by}`);
      return await this.schedulerService.approveTask(parseInt(id, 10), dto.approved_by);
    } catch (error) {
      this.logger.error(`❌ Approve task failed: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete('cancel/:id')
  @BypassRegulation()
  @ApiOperation({
    summary: 'Cancel a scheduled task',
    description: 'Cancel a pending or scheduled task (cannot cancel running or completed tasks)',
  })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiBody({ type: CancelTaskDto })
  @ApiResponse({ status: 200, description: 'Task cancelled' })
  @ApiResponse({ status: 400, description: 'Cannot cancel task (already running/completed)' })
  async cancelTask(@Param('id') id: string, @Body() dto: CancelTaskDto) {
    try {
      this.logger.log(`🚫 Cancel task #${id} by ${dto.cancelled_by}`);
      return await this.schedulerService.cancelTask(parseInt(id, 10), dto.cancelled_by);
    } catch (error) {
      this.logger.error(`❌ Cancel task failed: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Get('pending')
  @BypassRegulation()
  @ApiOperation({
    summary: 'Get all pending tasks awaiting approval',
    description: 'Returns tasks that require human approval before execution',
  })
  @ApiResponse({ status: 200, description: 'Pending tasks retrieved' })
  async getPendingTasks() {
    try {
      return await this.schedulerService.getPendingTasks();
    } catch (error) {
      this.logger.error(`❌ Get pending tasks failed: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('goal/:goalId')
  @BypassRegulation()
  @ApiOperation({
    summary: 'Get all scheduled tasks for a specific goal',
    description: 'Returns all tasks (pending, running, completed, failed) linked to a goal',
  })
  @ApiParam({ name: 'goalId', description: 'Goal ID' })
  @ApiResponse({ status: 200, description: 'Goal tasks retrieved' })
  async getTasksForGoal(@Param('goalId') goalId: string) {
    try {
      return await this.schedulerService.getTasksForGoal(parseInt(goalId, 10));
    } catch (error) {
      this.logger.error(`❌ Get goal tasks failed: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('status/:id')
  @BypassRegulation()
  @ApiOperation({
    summary: 'Get task status',
    description: 'Returns detailed status of a scheduled task',
  })
  @ApiParam({ name: 'id', description: 'Task ID' })
  @ApiResponse({ status: 200, description: 'Task status retrieved' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async getTaskStatus(@Param('id') id: string) {
    try {
      return await this.schedulerService.getTaskStatus(parseInt(id, 10));
    } catch (error) {
      this.logger.error(`❌ Get task status failed: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }
}
