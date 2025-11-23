
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Health check endpoint',
    description: 'Returns the health status of the VCTT-AGI Engine service.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'healthy' },
        timestamp: { type: 'string', example: '2024-01-15T10:30:00Z' },
        service: { type: 'string', example: 'VCTT-AGI Coherence Kernel' },
        version: { type: 'string', example: '1.0.0' },
      },
    },
  })
  healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'VCTT-AGI Coherence Kernel',
      version: '1.0.0',
    };
  }

  @Get('metadata')
  @ApiOperation({
    summary: 'System metadata endpoint',
    description: 'Returns deployment metadata including instance identity, platform, role, and connected services. Use this to understand which backend instance you are interacting with.',
  })
  @ApiResponse({
    status: 200,
    description: 'System metadata retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        instance_id: { type: 'string', example: 'vctt-agi-render-production' },
        deployment_platform: { type: 'string', example: 'render', enum: ['render', 'abacus-ai', 'local'] },
        role: { type: 'string', example: 'production', enum: ['production', 'development', 'staging', 'backup'] },
        purpose: { type: 'string', example: 'Main production backend for VCTT-AGI MIN system' },
        connected_services: {
          type: 'object',
          properties: {
            frontend_url: { type: 'string', example: 'https://vctt-agi-ui.vercel.app' },
            database: { type: 'string', example: 'postgresql-production' },
          },
        },
        capabilities: {
          type: 'array',
          items: { type: 'string' },
          example: ['chat', 'goals', 'safety', 'coach', 'skills'],
        },
        version: { type: 'string', example: '1.0.0' },
        deployed_at: { type: 'string', example: '2025-11-22T10:30:00Z' },
      },
    },
  })
  getMetadata() {
    const platform = this.configService.get<string>('DEPLOYMENT_PLATFORM', 'unknown');
    const role = this.configService.get<string>('DEPLOYMENT_ROLE', 'unknown');
    const instanceName = this.configService.get<string>('INSTANCE_NAME', 'unknown-instance');
    const frontendUrl = this.configService.get<string>('CONNECTED_FRONTEND', 'unknown');
    
    return {
      instance_id: instanceName,
      deployment_platform: platform,
      role: role,
      purpose: `VCTT-AGI ${role} backend`,
      connected_services: {
        frontend_url: frontendUrl,
        database: platform === 'render' ? 'postgresql-production' : 'postgresql-development',
      },
      capabilities: ['chat', 'goals', 'safety', 'coach', 'skills', 'scheduler', 'memory', 'knowledge-graph'],
      version: '1.0.0',
      deployed_at: new Date().toISOString(),
    };
  }
}
