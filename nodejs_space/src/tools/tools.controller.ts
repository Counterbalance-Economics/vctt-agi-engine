
import { Controller, Post, Get, Body, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ToolsService } from './tools.service';
import { InvokeToolDto, ToolInvocationResponseDto } from './dto/tool-invocation.dto';

@ApiTags('Tools')
@Controller('tools')
export class ToolsController {
  private readonly logger = new Logger(ToolsController.name);

  constructor(private readonly toolsService: ToolsService) {}

  @Post('invoke')
  @ApiOperation({
    summary: 'Invoke a tool',
    description: 'Execute a standardized tool with full audit logging and mode gating',
  })
  @ApiResponse({ status: 200, type: ToolInvocationResponseDto })
  async invokeTool(
    @Body() dto: InvokeToolDto,
    @Query('userId') userId?: string,
    @Query('mode') mode?: string,
  ) {
    this.logger.log(`Tool invocation request: ${dto.tool}`);
    return this.toolsService.invokeTool(dto, userId || 'anonymous', mode || 'SAFE_MODE');
  }

  @Get('registry')
  @ApiOperation({
    summary: 'Get all registered tools',
    description: 'Returns the list of all available tools with their definitions',
  })
  async getRegistry() {
    return this.toolsService.getRegisteredTools();
  }

  @Get('history')
  @ApiOperation({
    summary: 'Get tool invocation history',
    description: 'Returns audit trail of tool invocations',
  })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'toolName', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getHistory(
    @Query('userId') userId?: string,
    @Query('toolName') toolName?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.toolsService.getToolHistory({
      userId,
      toolName,
      status,
      limit: limit ? parseInt(limit) : 100,
    });
  }
}
