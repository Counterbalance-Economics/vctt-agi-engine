
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsIn, Min, Max } from 'class-validator';
import { GoalService, CreateGoalDto, UpdateGoalDto, AddProgressDto } from '../services/goal.service';
import { BypassRegulation } from '../guards/regulation.guard';

// DTOs
class CreateGoalRequestDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number;

  @IsString()
  @IsIn(['human', 'system', 'min'])
  owner: 'human' | 'system' | 'min';

  @IsOptional()
  @IsInt()
  parentGoalId?: number;

  @IsString()
  createdBy: string;

  @IsOptional()
  metadata?: any;
}

class UpdateGoalRequestDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsIn(['proposed', 'active', 'paused', 'completed', 'abandoned'])
  status?: 'proposed' | 'active' | 'paused' | 'completed' | 'abandoned';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number;

  @IsOptional()
  metadata?: any;

  @IsString()
  updatedBy: string;
}

class AddProgressRequestDto {
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent: number;

  @IsOptional()
  @IsString()
  milestone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsString()
  recordedBy: string;
}

class ChangeStatusDto {
  @IsString()
  @IsIn(['proposed', 'active', 'paused', 'completed', 'abandoned'])
  status: 'proposed' | 'active' | 'paused' | 'completed' | 'abandoned';

  @IsString()
  actor: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller('api/goals')
@ApiTags('Goals')
export class GoalController {
  private readonly logger = new Logger(GoalController.name);

  constructor(private readonly goalService: GoalService) {}

  @Post()
  @BypassRegulation()
  @ApiOperation({ summary: 'Create a new goal' })
  @ApiResponse({ status: 201, description: 'Goal created successfully' })
  @ApiResponse({ status: 403, description: 'Blocked by safety system' })
  async createGoal(@Body() dto: CreateGoalRequestDto) {
    try {
      const goal = await this.goalService.createGoal(dto);
      return {
        success: true,
        timestamp: new Date().toISOString(),
        goal,
      };
    } catch (error) {
      this.logger.error('Error creating goal:', error);
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get all goals' })
  @ApiResponse({ status: 200, description: 'Goals retrieved successfully' })
  async getGoals(
    @Query('status') status?: string,
    @Query('owner') owner?: string,
    @Query('priority') priority?: string,
  ) {
    try {
      const filters: any = {};
      if (status) filters.status = status;
      if (owner) filters.owner = owner;
      if (priority) filters.priority = parseInt(priority);

      const goals = await this.goalService.getGoals(filters);
      return {
        success: true,
        timestamp: new Date().toISOString(),
        count: goals.length,
        goals,
      };
    } catch (error) {
      this.logger.error('Error fetching goals:', error);
      throw error;
    }
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active goals' })
  @ApiResponse({ status: 200, description: 'Active goals retrieved successfully' })
  async getActiveGoals() {
    try {
      const goals = await this.goalService.getActiveGoals();
      return {
        success: true,
        timestamp: new Date().toISOString(),
        count: goals.length,
        goals,
      };
    } catch (error) {
      this.logger.error('Error fetching active goals:', error);
      throw error;
    }
  }

  @Get('tree')
  @ApiOperation({ summary: 'Get goal hierarchy tree' })
  @ApiResponse({ status: 200, description: 'Goal tree retrieved successfully' })
  async getGoalTree() {
    try {
      const tree = await this.goalService.getGoalTree();
      return {
        success: true,
        timestamp: new Date().toISOString(),
        tree,
      };
    } catch (error) {
      this.logger.error('Error fetching goal tree:', error);
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single goal by ID' })
  @ApiResponse({ status: 200, description: 'Goal retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  async getGoal(@Param('id') id: string) {
    try {
      const goal = await this.goalService.getGoal(parseInt(id));
      return {
        success: true,
        timestamp: new Date().toISOString(),
        goal,
      };
    } catch (error) {
      this.logger.error('Error fetching goal:', error);
      throw error;
    }
  }

  @Put(':id')
  @BypassRegulation()
  @ApiOperation({ summary: 'Update a goal' })
  @ApiResponse({ status: 200, description: 'Goal updated successfully' })
  @ApiResponse({ status: 403, description: 'Blocked by safety system' })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  async updateGoal(@Param('id') id: string, @Body() dto: UpdateGoalRequestDto) {
    try {
      const goal = await this.goalService.updateGoal(
        parseInt(id),
        dto,
        dto.updatedBy,
      );
      return {
        success: true,
        timestamp: new Date().toISOString(),
        goal,
      };
    } catch (error) {
      this.logger.error('Error updating goal:', error);
      throw error;
    }
  }

  @Post(':id/status')
  @BypassRegulation()
  @ApiOperation({ summary: 'Change goal status' })
  @ApiResponse({ status: 200, description: 'Status changed successfully' })
  @ApiResponse({ status: 403, description: 'Blocked by safety system' })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  async changeStatus(@Param('id') id: string, @Body() dto: ChangeStatusDto) {
    try {
      const goal = await this.goalService.changeStatus(
        parseInt(id),
        dto.status,
        dto.actor,
        dto.reason,
      );
      return {
        success: true,
        timestamp: new Date().toISOString(),
        goal,
      };
    } catch (error) {
      this.logger.error('Error changing status:', error);
      throw error;
    }
  }

  @Post(':id/progress')
  @BypassRegulation()
  @ApiOperation({ summary: 'Add progress update to a goal' })
  @ApiResponse({ status: 201, description: 'Progress added successfully' })
  @ApiResponse({ status: 403, description: 'Blocked by safety system' })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  async addProgress(@Param('id') id: string, @Body() dto: AddProgressRequestDto) {
    try {
      const progress = await this.goalService.addProgress(parseInt(id), dto);
      return {
        success: true,
        timestamp: new Date().toISOString(),
        progress,
      };
    } catch (error) {
      this.logger.error('Error adding progress:', error);
      throw error;
    }
  }

  @Delete(':id')
  @BypassRegulation()
  @ApiOperation({ summary: 'Delete a goal' })
  @ApiResponse({ status: 200, description: 'Goal deleted successfully' })
  @ApiResponse({ status: 403, description: 'Blocked by safety system' })
  @ApiResponse({ status: 404, description: 'Goal not found' })
  async deleteGoal(@Param('id') id: string, @Query('deletedBy') deletedBy: string) {
    try {
      if (!deletedBy) {
        throw new HttpException(
          'deletedBy query parameter is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.goalService.deleteGoal(parseInt(id), deletedBy);
      return {
        success: true,
        timestamp: new Date().toISOString(),
        message: 'Goal deleted successfully',
      };
    } catch (error) {
      this.logger.error('Error deleting goal:', error);
      throw error;
    }
  }
}
