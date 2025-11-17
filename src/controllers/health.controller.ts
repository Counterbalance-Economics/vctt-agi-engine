
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health Check')
@Controller('health')
export class HealthController {
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
}
