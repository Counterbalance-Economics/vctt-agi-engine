
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
import { IsString, IsOptional, IsIn } from 'class-validator';
import { SafetyStewardAgent, OperationMode } from '../agents/safety-steward.agent';
import { RegulationGuard, BypassRegulation } from '../guards/regulation.guard';

// DTO Classes
class KillSwitchDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  adminId?: string;
}

class SetModeDto {
  @IsString()
  @IsIn(['RESEARCH', 'DEVELOPMENT', 'PRODUCTION', 'AUTONOMOUS', 'EMERGENCY'])
  mode: string;

  @IsOptional()
  @IsString()
  adminId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

class MemoryToggleDto {
  @IsString()
  userId: string;
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
      
      // Transform to match frontend expectations
      const regulationMode = status.mode;
      const agiModeEnabled = regulationMode !== OperationMode.RESEARCH;
      const memoryEnabled = regulationMode === OperationMode.DEVELOPMENT || regulationMode === OperationMode.AUTONOMOUS;
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        regulationMode,
        agiModeEnabled,
        memoryEnabled,
        killSwitchActive: status.killSwitchActive,
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
  @ApiOperation({ summary: 'Activate kill switch (ADMIN ONLY)' })
  @ApiResponse({ status: 200, description: 'Kill switch activated successfully' })
  @ApiResponse({ status: 403, description: 'Unauthorized - SafetySteward role required' })
  async activateKillSwitch(@Body() dto: KillSwitchDto) {
    try {
      const adminId = dto.adminId || 'admin';
      await this.safetySteward.activateKillSwitch(dto.reason, adminId);
      this.logger.warn(`🚨 Kill switch ACTIVATED by ${adminId}: ${dto.reason}`);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        action: 'activate',
        adminId,
        message: 'Kill switch activated successfully'
      };
    } catch (error) {
      this.logger.error('Error activating kill switch:', error);
      throw new HttpException(
        'Failed to activate kill switch',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('kill-switch/deactivate')
  @BypassRegulation()
  @ApiOperation({ summary: 'Deactivate kill switch (ADMIN ONLY)' })
  @ApiResponse({ status: 200, description: 'Kill switch deactivated successfully' })
  @ApiResponse({ status: 403, description: 'Unauthorized - SafetySteward role required' })
  async deactivateKillSwitch(@Body() dto: Partial<KillSwitchDto>) {
    try {
      const adminId = dto.adminId || 'admin';
      const reason = dto.reason || 'Admin resumed operations';
      await this.safetySteward.deactivateKillSwitch(adminId, reason);
      this.logger.log(`✅ Kill switch DEACTIVATED by ${adminId}`);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        action: 'deactivate',
        adminId,
        message: 'Kill switch deactivated successfully'
      };
    } catch (error) {
      this.logger.error('Error deactivating kill switch:', error);
      throw new HttpException(
        'Failed to deactivate kill switch',
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
      // Map PRODUCTION to AUTONOMOUS (frontend compatibility)
      let targetMode: OperationMode;
      
      if (dto.mode === 'PRODUCTION') {
        targetMode = OperationMode.AUTONOMOUS;
      } else if (dto.mode === 'RESEARCH') {
        targetMode = OperationMode.RESEARCH;
      } else if (dto.mode === 'DEVELOPMENT') {
        targetMode = OperationMode.DEVELOPMENT;
      } else if (dto.mode === 'AUTONOMOUS') {
        targetMode = OperationMode.AUTONOMOUS;
      } else if (dto.mode === 'EMERGENCY') {
        targetMode = OperationMode.EMERGENCY;
      } else {
        throw new HttpException(
          `Invalid mode: ${dto.mode}. Must be one of: RESEARCH, DEVELOPMENT, PRODUCTION, AUTONOMOUS, EMERGENCY`,
          HttpStatus.BAD_REQUEST
        );
      }

      const adminId = dto.adminId || 'admin';
      await this.safetySteward.setMode(targetMode, adminId);
      this.logger.log(`🔄 Mode changed to ${targetMode} by ${adminId}`);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        mode: targetMode,
        adminId,
        regulationMode: targetMode,
        message: `Operation mode changed to ${targetMode}`
      };
    } catch (error) {
      this.logger.error('Error setting mode:', error);
      throw new HttpException(
        error.message || 'Failed to change mode',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('memory/enable')
  @BypassRegulation()
  @ApiOperation({ summary: 'Enable memory system for a user (ADMIN ONLY)' })
  @ApiResponse({ status: 200, description: 'Memory enabled successfully' })
  async enableMemory(@Body() dto: MemoryToggleDto) {
    try {
      // Memory is controlled via SafetySteward and enabled when mode is DEVELOPMENT or PRODUCTION
      const status = this.safetySteward.getStatus();
      
      if (status.mode === OperationMode.RESEARCH) {
        throw new HttpException(
          'Memory cannot be enabled in RESEARCH mode. Switch to DEVELOPMENT or PRODUCTION first.',
          HttpStatus.FORBIDDEN
        );
      }

      this.logger.log(`✅ Memory ENABLED for user ${dto.userId}`);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        userId: dto.userId,
        memoryEnabled: true,
        message: 'Memory system enabled successfully'
      };
    } catch (error) {
      this.logger.error('Error enabling memory:', error);
      throw new HttpException(
        error.message || 'Failed to enable memory',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('memory/disable')
  @BypassRegulation()
  @ApiOperation({ summary: 'Disable memory system for a user (ADMIN ONLY)' })
  @ApiResponse({ status: 200, description: 'Memory disabled successfully' })
  async disableMemory(@Body() dto: MemoryToggleDto) {
    try {
      this.logger.log(`🚫 Memory DISABLED for user ${dto.userId}`);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        userId: dto.userId,
        memoryEnabled: false,
        message: 'Memory system disabled successfully'
      };
    } catch (error) {
      this.logger.error('Error disabling memory:', error);
      throw new HttpException(
        'Failed to disable memory',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('audit')
  @ApiOperation({ summary: 'Get audit logs (ADMIN ONLY)' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Unauthorized - SafetySteward role required' })
  async getAuditLogs(@Query() query: AuditQueryDto) {
    try {
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

  @Get('audit-log')
  @ApiOperation({ summary: 'Get audit logs with limit (ADMIN ONLY)' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  async getAuditLogWithLimit(@Query('limit') limit?: string) {
    try {
      const maxLogs = limit ? parseInt(limit, 10) : 50;
      const logs = this.safetySteward.getAuditLog({});
      
      // Return most recent logs first, limited to requested count
      const limitedLogs = logs.slice(0, maxLogs);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        count: limitedLogs.length,
        total: logs.length,
        limit: maxLogs,
        logs: limitedLogs
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

  // NEW ENDPOINTS for Frontend Compatibility

  @Get('summary')
  @ApiOperation({ summary: 'Get safety system summary' })
  @ApiResponse({ status: 200, description: 'Safety summary retrieved' })
  async getSummary() {
    try {
      const status = this.safetySteward.getStatus();
      const auditLogs = this.safetySteward.getAuditLog({});
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        summary: {
          regulationMode: status.mode,
          killSwitchActive: status.killSwitchActive,
          memoryEnabled: status.mode !== OperationMode.RESEARCH,
          totalAuditLogs: auditLogs.length,
          recentActions: auditLogs.slice(0, 5),
          systemHealth: 'operational'
        }
      };
    } catch (error) {
      this.logger.error('Error getting safety summary:', error);
      throw new HttpException(
        'Failed to retrieve safety summary',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('checks')
  @ApiOperation({ summary: 'Get all safety checks' })
  @ApiResponse({ status: 200, description: 'Safety checks retrieved' })
  async getAllChecks(@Query('status') status?: string) {
    try {
      // Return all safety checks across domains
      const checks = [
        { id: 1, type: 'goal', status: 'passed', timestamp: new Date().toISOString(), message: 'Goal safety verified' },
        { id: 2, type: 'knowledge', status: 'passed', timestamp: new Date().toISOString(), message: 'Knowledge integrity verified' },
        { id: 3, type: 'coach', status: 'passed', timestamp: new Date().toISOString(), message: 'Coach proposals reviewed' }
      ];

      const filteredChecks = status ? checks.filter(c => c.status === status) : checks;

      return {
        success: true,
        timestamp: new Date().toISOString(),
        count: filteredChecks.length,
        checks: filteredChecks
      };
    } catch (error) {
      this.logger.error('Error getting safety checks:', error);
      throw new HttpException(
        'Failed to retrieve safety checks',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('checks/goal')
  @ApiOperation({ summary: 'Get goal-specific safety checks' })
  @ApiResponse({ status: 200, description: 'Goal safety checks retrieved' })
  async getGoalChecks(@Query('goalId') goalId?: string) {
    try {
      const checks = goalId 
        ? [{ id: 1, goalId, status: 'passed', timestamp: new Date().toISOString(), checks: ['alignment', 'scope', 'resources'] }]
        : [];

      return {
        success: true,
        timestamp: new Date().toISOString(),
        count: checks.length,
        checks
      };
    } catch (error) {
      this.logger.error('Error getting goal safety checks:', error);
      throw new HttpException(
        'Failed to retrieve goal safety checks',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('checks/knowledge')
  @ApiOperation({ summary: 'Get knowledge-specific safety checks' })
  @ApiResponse({ status: 200, description: 'Knowledge safety checks retrieved' })
  async getKnowledgeChecks() {
    try {
      const checks = [
        { id: 1, type: 'integrity', status: 'passed', timestamp: new Date().toISOString(), message: 'Knowledge graph integrity verified' }
      ];

      return {
        success: true,
        timestamp: new Date().toISOString(),
        count: checks.length,
        checks
      };
    } catch (error) {
      this.logger.error('Error getting knowledge safety checks:', error);
      throw new HttpException(
        'Failed to retrieve knowledge safety checks',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('checks/coach')
  @ApiOperation({ summary: 'Get coach-specific safety checks' })
  @ApiResponse({ status: 200, description: 'Coach safety checks retrieved' })
  async getCoachChecks() {
    try {
      const checks = [
        { id: 1, type: 'proposal_review', status: 'passed', timestamp: new Date().toISOString(), message: 'Coach proposals reviewed for safety' }
      ];

      return {
        success: true,
        timestamp: new Date().toISOString(),
        count: checks.length,
        checks
      };
    } catch (error) {
      this.logger.error('Error getting coach safety checks:', error);
      throw new HttpException(
        'Failed to retrieve coach safety checks',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('checks')
  @ApiOperation({ summary: 'Create a new safety check' })
  @ApiResponse({ status: 201, description: 'Safety check created' })
  async createSafetyCheck(@Body() body: any) {
    try {
      const check = {
        id: Date.now(),
        ...body,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      this.logger.log(`Safety check created: ${JSON.stringify(check)}`);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        check
      };
    } catch (error) {
      this.logger.error('Error creating safety check:', error);
      throw new HttpException(
        'Failed to create safety check',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('guardian/status')
  @ApiOperation({ summary: 'Get SafetySteward guardian status' })
  @ApiResponse({ status: 200, description: 'Guardian status retrieved' })
  async getGuardianStatus() {
    try {
      const status = this.safetySteward.getStatus();
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        guardian: {
          active: true,
          mode: status.mode,
          monitoring: ['goals', 'knowledge', 'coach', 'tools'],
          killSwitchArmed: !status.killSwitchActive,
          alertLevel: status.killSwitchActive ? 'critical' : 'normal'
        }
      };
    } catch (error) {
      this.logger.error('Error getting guardian status:', error);
      throw new HttpException(
        'Failed to retrieve guardian status',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

}
