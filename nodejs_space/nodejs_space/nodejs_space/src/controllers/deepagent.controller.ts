
import { Controller, Post, Body, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { IsString } from 'class-validator';

class ExecuteCommandDto {
  @IsString()
  command: string;
}

@ApiTags('DeepAgent')
@Controller('api/deep')
export class DeepAgentController {
  private readonly logger = new Logger(DeepAgentController.name);

  @Post('execute')
  @ApiOperation({ summary: 'Execute a terminal command (sandboxed)' })
  @ApiResponse({ status: 200, description: 'Command executed' })
  @ApiResponse({ status: 400, description: 'Invalid command' })
  @ApiBody({ type: ExecuteCommandDto })
  async executeCommand(@Body() dto: ExecuteCommandDto): Promise<any> {
    try {
      this.logger.log(`DeepAgent command requested: ${dto.command}`);

      // Security check: block dangerous commands
      const dangerousPatterns = [
        'rm -rf',
        'dd if=',
        'mkfs',
        'format',
        '> /dev/',
        'wget',
        'curl',
        'chmod 777'
      ];

      const isDangerous = dangerousPatterns.some(pattern =>
        dto.command.toLowerCase().includes(pattern.toLowerCase())
      );

      if (isDangerous) {
        this.logger.warn(`🚨 Blocked dangerous command: ${dto.command}`);
        return {
          success: false,
          timestamp: new Date().toISOString(),
          output: null,
          error: 'Command blocked by safety system: potentially dangerous operation detected'
        };
      }

      // Simulated command execution (safe mode)
      // In production, this would use a sandboxed environment
      const output = this.simulateCommandExecution(dto.command);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        command: dto.command,
        output,
        error: null
      };
    } catch (error) {
      this.logger.error('Error executing command:', error);
      return {
        success: false,
        timestamp: new Date().toISOString(),
        output: null,
        error: error.message || 'Command execution failed'
      };
    }
  }

  private simulateCommandExecution(command: string): string {
    // Parse common commands and return simulated output
    const cmd = command.trim().toLowerCase();

    if (cmd === 'pwd') {
      return '/home/vctt-agi/workspace';
    }

    if (cmd === 'ls' || cmd === 'ls -la') {
      return `total 12
drwxr-xr-x  3 vctt vctt 4096 Nov 22 00:00 .
drwxr-xr-x 10 vctt vctt 4096 Nov 22 00:00 ..
drwxr-xr-x  2 vctt vctt 4096 Nov 22 00:00 src
-rw-r--r--  1 vctt vctt  256 Nov 22 00:00 README.md
-rw-r--r--  1 vctt vctt  128 Nov 22 00:00 package.json`;
    }

    if (cmd.startsWith('cat ')) {
      const filename = cmd.replace('cat ', '').trim();
      return `Contents of ${filename}:\n(Simulated output - DeepAgent is in safe mode)`;
    }

    if (cmd === 'whoami') {
      return 'vctt-agi-agent';
    }

    if (cmd === 'date') {
      return new Date().toString();
    }

    if (cmd.startsWith('echo ')) {
      return cmd.replace('echo ', '');
    }

    if (cmd === 'help' || cmd === '--help') {
      return `DeepAgent Terminal - Safe Mode

Available commands:
  ls        - List directory contents
  pwd       - Print working directory
  cat       - Display file contents (simulated)
  echo      - Print text
  date      - Show current date/time
  whoami    - Show current user
  help      - Show this help message

Note: DeepAgent is running in SAFE MODE. 
Real file system operations are disabled.
To enable full capabilities, contact your administrator.`;
    }

    // Unknown command
    return `bash: ${command}: command not found

Type 'help' for available commands.`;
  }
}
