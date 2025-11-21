
import { Injectable, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ToolName, InvokeToolDto } from './dto/tool-invocation.dto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ToolDefinition {
  name: ToolName;
  description: string;
  requiredMode: string[];
  requiredPermissions: string[];
  inputSchema: Record<string, any>;
}

@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);
  private readonly workspaceRoot = '/home/ubuntu/vctt_agi_workspace';

  constructor(private prisma: PrismaService) {}

  /**
   * Get all registered tools from the database
   */
  async getRegisteredTools(): Promise<ToolDefinition[]> {
    const tools = await this.prisma.toolRegistry.findMany();
    return tools.map((t) => ({
      name: t.name as ToolName,
      description: t.description,
      requiredMode: t.requiredMode,
      requiredPermissions: t.requiredPermissions,
      inputSchema: t.inputSchema as Record<string, any>,
    }));
  }

  /**
   * Invoke a tool with full audit logging and mode gating
   */
  async invokeTool(
    dto: InvokeToolDto,
    userId: string = 'system',
    mode: string = 'SAFE_MODE',
  ): Promise<any> {
    const startTime = Date.now();
    const invocationId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.logger.log(
      `[TOOL INVOCATION] ${invocationId} | Tool: ${dto.tool} | User: ${userId} | Mode: ${mode}`,
    );

    try {
      // 1. Verify tool is registered
      const toolDef = await this.prisma.toolRegistry.findUnique({
        where: { name: dto.tool },
      });

      if (!toolDef) {
        throw new BadRequestException(`Tool ${dto.tool} is not registered`);
      }

      // 2. Mode gating check
      if (!toolDef.requiredMode.includes(mode)) {
        throw new ForbiddenException(
          `Tool ${dto.tool} requires mode ${toolDef.requiredMode.join(' or ')}, current mode: ${mode}`,
        );
      }

      // 3. Execute the tool
      let output: any;
      let status = 'SUCCESS';
      let errorMessage: string | undefined;

      try {
        switch (dto.tool) {
          case ToolName.READ_FILE:
            output = await this.readFile(dto.input);
            break;
          case ToolName.WRITE_FILE:
            output = await this.writeFile(dto.input);
            break;
          case ToolName.RUN_COMMAND:
            output = await this.runCommand(dto.input, mode);
            break;
          case ToolName.SEARCH_WEB:
            output = await this.searchWeb(dto.input);
            break;
          case ToolName.CALL_LLM:
            output = await this.callLLM(dto.input);
            break;
          case ToolName.QUERY_DB:
            output = await this.queryDB(dto.input);
            break;
          case ToolName.SCHEDULE_TASK:
            output = await this.scheduleTask(dto.input, userId);
            break;
          default:
            throw new BadRequestException(`Unknown tool: ${dto.tool}`);
        }
      } catch (error) {
        status = 'FAILED';
        errorMessage = error.message;
        output = { error: error.message };
        this.logger.error(`Tool ${dto.tool} execution failed: ${error.message}`, error.stack);
      }

      const executionTimeMs = Date.now() - startTime;

      // 4. Audit log to database
      await this.prisma.toolInvocation.create({
        data: {
          invocationId,
          toolName: dto.tool,
          input: dto.input as any,
          output: output as any,
          status,
          mode,
          userId,
          justification: dto.justification || '',
          context: dto.context || '',
          executionTimeMs,
          timestamp: new Date(),
          error: errorMessage,
        },
      });

      // 5. Also log to autonomy audit
      await this.prisma.autonomyAudit.create({
        data: {
          eventType: 'TOOL_INVOCATION',
          actorType: 'USER',
          actorId: userId,
          action: `INVOKE_${dto.tool}`,
          targetResource: JSON.stringify(dto.input),
          outcome: status,
          metadata: {
            invocationId,
            executionTimeMs,
            mode,
          } as any,
          timestamp: new Date(),
        },
      });

      this.logger.log(
        `[TOOL COMPLETE] ${invocationId} | Status: ${status} | Time: ${executionTimeMs}ms`,
      );

      return {
        invocationId,
        tool: dto.tool,
        status,
        output,
        executionTimeMs,
        timestamp: new Date(),
        error: errorMessage,
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      this.logger.error(`[TOOL ERROR] ${invocationId} | ${error.message}`, error.stack);

      // Log failed invocation
      await this.prisma.toolInvocation.create({
        data: {
          invocationId,
          toolName: dto.tool,
          input: dto.input as any,
          output: { error: error.message } as any,
          status: 'FAILED',
          mode,
          userId,
          justification: dto.justification || '',
          context: dto.context || '',
          executionTimeMs,
          timestamp: new Date(),
          error: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * Get tool invocation history
   */
  async getToolHistory(filters?: {
    userId?: string;
    toolName?: string;
    status?: string;
    limit?: number;
  }) {
    const { userId, toolName, status, limit = 100 } = filters || {};

    return this.prisma.toolInvocation.findMany({
      where: {
        ...(userId && { userId }),
        ...(toolName && { toolName }),
        ...(status && { status }),
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  // ==================== TOOL IMPLEMENTATIONS ====================

  private async readFile(input: { filePath: string }): Promise<any> {
    const { filePath } = input;
    const safePath = path.join(this.workspaceRoot, filePath);

    // Security: prevent path traversal
    if (!safePath.startsWith(this.workspaceRoot)) {
      throw new ForbiddenException('Path traversal detected');
    }

    try {
      const content = await fs.readFile(safePath, 'utf-8');
      const stats = await fs.stat(safePath);
      return {
        filePath,
        content,
        size: stats.size,
        modified: stats.mtime,
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new BadRequestException(`File not found: ${filePath}`);
      }
      throw error;
    }
  }

  private async writeFile(input: { filePath: string; content: string }): Promise<any> {
    const { filePath, content } = input;
    const safePath = path.join(this.workspaceRoot, filePath);

    // Security: prevent path traversal
    if (!safePath.startsWith(this.workspaceRoot)) {
      throw new ForbiddenException('Path traversal detected');
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(safePath), { recursive: true });
    await fs.writeFile(safePath, content, 'utf-8');

    const stats = await fs.stat(safePath);
    return {
      filePath,
      written: true,
      size: stats.size,
    };
  }

  private async runCommand(input: { command: string; args?: string[] }, mode: string): Promise<any> {
    // In SAFE_MODE, only allow whitelisted commands
    const safeCommands = ['ls', 'pwd', 'echo', 'cat', 'grep', 'find', 'wc'];
    const { command, args = [] } = input;

    if (mode === 'SAFE_MODE') {
      const baseCommand = command.split(' ')[0];
      if (!safeCommands.includes(baseCommand)) {
        throw new ForbiddenException(
          `Command "${baseCommand}" not allowed in SAFE_MODE. Allowed: ${safeCommands.join(', ')}`,
        );
      }
    }

    const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;

    try {
      const { stdout, stderr } = await execAsync(fullCommand, {
        cwd: this.workspaceRoot,
        timeout: 30000, // 30 second timeout
      });

      return {
        command: fullCommand,
        stdout,
        stderr,
        exitCode: 0,
      };
    } catch (error) {
      return {
        command: fullCommand,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1,
      };
    }
  }

  private async searchWeb(input: { query: string; maxResults?: number }): Promise<any> {
    const { query, maxResults = 5 } = input;

    // Placeholder - integrate with actual search API
    this.logger.log(`[SEARCH_WEB] Query: "${query}", maxResults: ${maxResults}`);

    // For now, return mock results
    return {
      query,
      results: [
        {
          title: 'Mock Search Result 1',
          url: 'https://example.com/1',
          snippet: 'This is a mock search result for demonstration purposes.',
        },
      ],
      timestamp: new Date(),
      note: 'MOCK DATA - Integrate with real search API in production',
    };
  }

  private async callLLM(input: {
    model: string;
    prompt: string;
    systemPrompt?: string;
    temperature?: number;
  }): Promise<any> {
    const { model, prompt, systemPrompt, temperature = 0.7 } = input;

    this.logger.log(`[CALL_LLM] Model: ${model}, Prompt length: ${prompt.length}`);

    // Placeholder - integrate with actual LLM API (Grok via x.ai)
    return {
      model,
      response: 'MOCK LLM RESPONSE - Integrate with real Grok/xAI API',
      tokensUsed: 150,
      timestamp: new Date(),
    };
  }

  private async queryDB(input: { query: string; params?: any[] }): Promise<any> {
    const { query, params = [] } = input;

    // Execute raw SQL query via Prisma
    try {
      const result = await this.prisma.$queryRawUnsafe(query, ...params);
      return {
        query,
        rows: result,
        rowCount: Array.isArray(result) ? result.length : 1,
      };
    } catch (error) {
      throw new BadRequestException(`Database query failed: ${error.message}`);
    }
  }

  private async scheduleTask(input: any, userId: string): Promise<any> {
    // Delegate to scheduler service
    const task = await this.prisma.scheduledTask.create({
      data: {
        taskType: input.taskType || 'DEFERRED',
        goalId: input.goalId || null,
        action: input.action,
        payload: input.payload || {},
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : new Date(),
        status: 'PENDING_APPROVAL',
        createdBy: userId,
        metadata: input.metadata || {},
      },
    });

    return {
      taskId: task.id,
      status: task.status,
      scheduledFor: task.scheduledFor,
      message: 'Task created and pending approval',
    };
  }
}
