
/**
 * Safety Controller
 * 
 * Admin API for managing AGI safety controls.
 * All endpoints require SafetySteward role.
 * 
 * Endpoints:
 * - GET /api/safety/status - Get current safety status
 * - POST /api/safety/kill-switch - Activate/deactivate kill switch
 * - POST /api/safety/mode - Change operation mode
 * - GET /api/safety/audit - Get audit logs
 * - POST /api/safety/config - Update safety config
 * 
 * @module controllers/safety
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SafetyStewardAgent, OperationMode } from '../agents/safety-steward.agent';
import { RegulationGuard, BypassRegulation } from '../guards/regulation.guard';

// DTO Classes
class KillSwitchDto {
  action: 'activate' | 'deactivate';
  reason: string;
  adminId: string;
}

class SetModeDto {
  mode: OperationMode;
  adminId: string;
  reason?: string;
}

class AuditQueryDto {
  userId?: string;
  startDate?: string;
  endDate?: string;
}

class SafetyConfigDto {
  AGI_MODE_ENABLED?: boolean;
  AUTONOMOUS_MODE_ENABLED?: boolean;
  MEMORY_PERSISTENCE_ENABLED?: boolean;
  WORLD_MODEL_UPDATES_ENABLED?: boolean;
}

@ApiTags('Safety & Admin')
@Controller('api/safety')
@ApiBearerAuth()
export class SafetyController {
  private readonly logger = new Logger(SafetyController.name);

  constructor(private readonly safetySteward: SafetyStewardAgent) {
    this.logger.log('🛡️ Safety Controller initialized');
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current safety status' })
  @ApiResponse({ status: 200, description: 'Safety status retrieved successfully' })
  async getStatus() {
    try {
      const status = this.safetySteward.getStatus();
      return {
        success: true,
        timestamp: new Date().toISOString(),
        data: status
      };
    } catch (error) {
      this.logger.error('Error getting safety status:', error);
      throw new HttpException(
        'Failed to retrieve safety status',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('kill-switch')
  @BypassRegulation()
  @ApiOperation({ summary: 'Activate or deactivate kill switch (ADMIN ONLY)' })
  @ApiResponse({ status: 200, description: 'Kill switch toggled successfully' })
  @ApiResponse({ status: 403, description: 'Unauthorized - SafetySteward role required' })
  async toggleKillSwitch(@Body() dto: KillSwitchDto) {
    try {
      // TODO: Add role verification for SafetySteward
      // For now, accept adminId from body (will be replaced with JWT auth)

      if (dto.action === 'activate') {
        await this.safetySteward.activateKillSwitch(dto.reason, dto.adminId);
        this.logger.warn(`🚨 Kill switch ACTIVATED by ${dto.adminId}`);
      } else {
        await this.safetySteward.deactivateKillSwitch(dto.adminId, dto.reason);
        this.logger.log(`✅ Kill switch DEACTIVATED by ${dto.adminId}`);
      }

      return {
        success: true,
        timestamp: new Date().toISOString(),
        action: dto.action,
        adminId: dto.adminId,
        message: `Kill switch ${dto.action}d successfully`
      };
    } catch (error) {
      this.logger.error('Error toggling kill switch:', error);
      throw new HttpException(
        'Failed to toggle kill switch',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('mode')
  @BypassRegulation()
  @ApiOperation({ summary: 'Change operation mode (ADMIN ONLY)' })
  @ApiResponse({ status: 200, description: 'Mode changed successfully' })
  @ApiResponse({ status: 403, description: 'Unauthorized - SafetySteward role required' })
  async setMode(@Body() dto: SetModeDto) {
    try {
      // TODO: Add role verification for SafetySteward
      
      const validModes = Object.values(OperationMode);
      if (!validModes.includes(dto.mode)) {
        throw new HttpException(
          `Invalid mode. Must be one of: ${validModes.join(', ')}`,
          HttpStatus.BAD_REQUEST
        );
      }

      await this.safetySteward.setMode(dto.mode, dto.adminId);
      this.logger.log(`🔄 Mode changed to ${dto.mode} by ${dto.adminId}`);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        mode: dto.mode,
        adminId: dto.adminId,
        message: `Operation mode changed to ${dto.mode}`
      };
    } catch (error) {
      this.logger.error('Error setting mode:', error);
      throw new HttpException(
        error.message || 'Failed to change mode',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('audit')
  @ApiOperation({ summary: 'Get audit logs (ADMIN ONLY)' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Unauthorized - SafetySteward role required' })
  async getAuditLogs(@Query() query: AuditQueryDto) {
    try {
      // TODO: Add role verification for SafetySteward

      const filter: any = {};
      
      if (query.userId) {
        filter.userId = query.userId;
      }
      if (query.startDate) {
        filter.startDate = new Date(query.startDate);
      }
      if (query.endDate) {
        filter.endDate = new Date(query.endDate);
      }

      const logs = this.safetySteward.getAuditLog(filter);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        count: logs.length,
        data: logs
      };
    } catch (error) {
      this.logger.error('Error retrieving audit logs:', error);
      throw new HttpException(
        'Failed to retrieve audit logs',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('config')
  @BypassRegulation()
  @ApiOperation({ summary: 'Update safety configuration (ADMIN ONLY)' })
  @ApiResponse({ status: 200, description: 'Configuration updated successfully' })
  @ApiResponse({ status: 403, description: 'Unauthorized - SafetySteward role required' })
  async updateConfig(@Body() dto: SafetyConfigDto) {
    try {
      // TODO: Add role verification for SafetySteward
      // TODO: Integrate with ConfigService to persist changes

      this.logger.warn('⚠️ Safety configuration update requested (not yet implemented)');
      this.logger.log(`Config changes: ${JSON.stringify(dto)}`);

      return {
        success: false,
        timestamp: new Date().toISOString(),
        message: 'Configuration updates not yet implemented. Use environment variables for now.',
        requested: dto
      };
    } catch (error) {
      this.logger.error('Error updating config:', error);
      throw new HttpException(
        'Failed to update configuration',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('charter')
  @ApiOperation({ summary: 'Get VCTT AGI Safety Charter' })
  @ApiResponse({ status: 200, description: 'Charter retrieved successfully' })
  async getCharter() {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      charter: {
        version: '1.0.0',
        effectiveDate: '2025-11-21',
        url: '/VCTT_AGI_SAFETY_CHARTER.md',
        summary: 'The VCTT AGI Safety Charter establishes immutable safety principles governing all AGI capabilities.',
        keyPrinciples: [
          'Human-In-Control',
          'Transparency',
          'Verifiability',
          'Reversibility',
          'Bounded Autonomy',
          'Harm Prevention'
        ]
      }
    };
  }
}
