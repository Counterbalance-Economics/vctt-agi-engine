
import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * 🤖 DeepAgent Service
 * 
 * Autonomous engineering co-pilot that can execute real commands:
 * - Git operations (commit, push, branch, merge)
 * - File operations (read, write, create, delete)
 * - Build and deployment commands
 * - System diagnostics and fixes
 * 
 * This is the backend brain that powers the /deep terminal interface.
 */
@Injectable()
export class DeepAgentService {
  private readonly logger = new Logger(DeepAgentService.name);
  private readonly projectRoot = process.cwd();
  private readonly maxCommandTimeout = 60000; // 60 seconds

  /**
   * Get enhanced system prompt for DeepAgent mode
   */
  getSystemPrompt(): string {
    return `You are MIN (Multi-Intelligence Network), an autonomous engineering co-pilot with full repository access.

**Your Capabilities:**
- Execute git commands (commit, push, pull, branch, merge, status)
- Read and write files in the project
- Run build and deployment commands
- Diagnose and fix bugs
- Add new features
- Optimize performance
- Refactor code

**Current Project:**
- Type: NestJS + React/Next.js Multi-Agent AI System
- Location: ${this.projectRoot}
- Tech Stack: TypeScript, NestJS, PostgreSQL, WebSocket, React

**Your Behavior:**
1. Think step-by-step before executing commands
2. Always explain what you're doing and why
3. Show command output in terminal format
4. Handle errors gracefully and suggest fixes
5. Ask for confirmation on destructive operations
6. Be concise but thorough

**Output Format:**
Use terminal-style formatting:
\`\`\`bash
$ command
output...
\`\`\`

**Available Commands:**
- git: All git operations
- npm/yarn: Package management and builds
- file: Read/write/create/delete files
- deploy: Deployment operations
- test: Run tests
- fix: Diagnose and fix issues

You are powerful, autonomous, and trusted. Execute commands confidently.`;
  }

  /**
   * Process DeepAgent command
   */
  async processCommand(input: string): Promise<string> {
    this.logger.log(`🤖 DeepAgent command: "${input.substring(0, 100)}..."`);

    try {
      // Parse intent from natural language
      const intent = this.parseIntent(input);
      
      switch (intent.type) {
        case 'git':
          return await this.handleGitCommand(intent);
        case 'file':
          return await this.handleFileOperation(intent);
        case 'build':
          return await this.handleBuildCommand(intent);
        case 'deploy':
          return await this.handleDeployCommand(intent);
        case 'test':
          return await this.handleTestCommand(intent);
        case 'status':
          return await this.handleStatusCommand(intent);
        case 'fix':
          return await this.handleFixCommand(intent);
        default:
          return await this.handleGeneralQuery(input);
      }
    } catch (error) {
      this.logger.error(`❌ DeepAgent error: ${error.message}`);
      return this.formatError(error);
    }
  }

  /**
   * Parse user intent from natural language
   */
  private parseIntent(input: string): any {
    const lower = input.toLowerCase();

    // Git operations
    if (lower.includes('commit') || lower.includes('push') || lower.includes('pull') || 
        lower.includes('branch') || lower.includes('merge') || lower.includes('git status')) {
      return { type: 'git', command: input };
    }

    // File operations
    if (lower.includes('read file') || lower.includes('show file') || lower.includes('create file') ||
        lower.includes('write file') || lower.includes('delete file') || lower.includes('edit file')) {
      return { type: 'file', command: input };
    }

    // Build operations
    if (lower.includes('build') || lower.includes('compile') || lower.includes('yarn install')) {
      return { type: 'build', command: input };
    }

    // Deploy operations
    if (lower.includes('deploy') || lower.includes('release')) {
      return { type: 'deploy', command: input };
    }

    // Test operations
    if (lower.includes('test') || lower.includes('run tests')) {
      return { type: 'test', command: input };
    }

    // Status check
    if (lower.includes('status') || lower.includes('what\'s the current') || lower.includes('show me')) {
      return { type: 'status', command: input };
    }

    // Fix/debug
    if (lower.includes('fix') || lower.includes('debug') || lower.includes('error') || lower.includes('broken')) {
      return { type: 'fix', command: input };
    }

    return { type: 'general', command: input };
  }

  /**
   * Handle git commands
   */
  private async handleGitCommand(intent: any): Promise<string> {
    const input = intent.command.toLowerCase();
    let command = '';

    if (input.includes('status')) {
      command = 'git status';
    } else if (input.includes('commit')) {
      // Extract commit message
      const match = input.match(/commit.*["']([^"']+)["']/);
      const message = match ? match[1] : 'Update';
      command = `git add -A && git commit -m "${message}"`;
    } else if (input.includes('push')) {
      command = 'git push origin main';
    } else if (input.includes('pull')) {
      command = 'git pull origin main';
    } else if (input.includes('branch')) {
      command = 'git branch -a';
    } else {
      return '❌ Could not parse git command. Please be more specific.';
    }

    return await this.executeCommand(command);
  }

  /**
   * Handle file operations
   */
  private async handleFileOperation(intent: any): Promise<string> {
    const input = intent.command;
    
    // Extract file path
    const pathMatch = input.match(/['"]([^'"]+)['"]/);
    if (!pathMatch) {
      return '❌ Please specify a file path in quotes.';
    }
    
    const filePath = path.join(this.projectRoot, pathMatch[1]);

    if (input.toLowerCase().includes('read') || input.toLowerCase().includes('show')) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return this.formatFileContent(pathMatch[1], content);
      } catch (error) {
        return `❌ Could not read file: ${error.message}`;
      }
    }

    if (input.toLowerCase().includes('create') || input.toLowerCase().includes('write')) {
      return '⚠️ File creation requires content. Please use the streaming interface for complex edits.';
    }

    return '❌ Unsupported file operation.';
  }

  /**
   * Handle build commands
   */
  private async handleBuildCommand(intent: any): Promise<string> {
    const input = intent.command.toLowerCase();

    if (input.includes('backend') || input.includes('nestjs')) {
      return await this.executeCommand('cd nodejs_space && yarn build', 30000);
    }

    if (input.includes('frontend') || input.includes('react')) {
      return '⚠️ Frontend builds should be done in the vctt_agi_ui repository.';
    }

    return await this.executeCommand('yarn build', 30000);
  }

  /**
   * Handle deploy commands
   */
  private async handleDeployCommand(intent: any): Promise<string> {
    return `🚀 **Deployment Options:**

**Backend (NestJS):**
- Deployed on Render: https://vctt-agi-phase3-complete.abacusai.app
- To deploy: Push to main branch, Render auto-deploys

**Frontend (React):**
- Deployed on Vercel: Auto-deploys on push to main

**To deploy both:**
1. \`git push origin main\`
2. Wait ~2 minutes for auto-deployment
3. Check logs for any errors

Current status: ${await this.getDeploymentStatus()}`;
  }

  /**
   * Handle test commands
   */
  private async handleTestCommand(intent: any): Promise<string> {
    return await this.executeCommand('yarn test', 30000);
  }

  /**
   * Handle status commands
   */
  private async handleStatusCommand(intent: any): Promise<string> {
    const gitStatus = await this.executeCommand('git status --short');
    const branchInfo = await this.executeCommand('git branch --show-current');
    
    return `📊 **Current Status:**

**Branch:** ${branchInfo}

**Git Status:**
${gitStatus}

**Project:** VCTT-AGI Engine (Multi-Agent AI System)
**Location:** ${this.projectRoot}
**Backend:** NestJS + TypeScript
**Frontend:** React + Next.js (separate repo)`;
  }

  /**
   * Handle fix/debug commands
   */
  private async handleFixCommand(intent: any): Promise<string> {
    return `🔧 **Diagnostic Mode:**

To help debug, I need more information:
1. What error are you seeing?
2. Where is it occurring? (frontend/backend)
3. What were you trying to do?

**Common fixes:**
- \`yarn install\` - Fix dependency issues
- \`git status\` - Check for uncommitted changes
- \`yarn build\` - Rebuild the project
- Check logs for error details

Please describe the issue and I'll help fix it.`;
  }

  /**
   * Handle general queries
   */
  private async handleGeneralQuery(input: string): Promise<string> {
    return `🤖 **MIN DeepAgent Mode**

I can help you with:
- **Git:** commit, push, pull, status, branches
- **Files:** read, write, create, delete
- **Build:** compile, install dependencies
- **Deploy:** deployment status and operations
- **Test:** run test suites
- **Fix:** diagnose and fix issues

**Examples:**
- "Show git status"
- "Commit changes with message 'Fixed bug'"
- "Read file 'src/main.ts'"
- "Build the backend"
- "What's broken?"

What would you like me to do?`;
  }

  /**
   * Execute shell command with timeout
   */
  private async executeCommand(command: string, timeout = this.maxCommandTimeout): Promise<string> {
    this.logger.log(`🔧 Executing: ${command}`);

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.projectRoot,
        timeout,
        maxBuffer: 1024 * 1024 * 10, // 10MB
      });

      const output = (stdout + stderr).trim();
      return this.formatCommandOutput(command, output, true);
    } catch (error) {
      return this.formatCommandOutput(command, error.message, false);
    }
  }

  /**
   * Format command output in terminal style
   */
  private formatCommandOutput(command: string, output: string, success: boolean): string {
    const icon = success ? '✅' : '❌';
    return `${icon} **$ ${command}**

\`\`\`
${output || '(no output)'}
\`\`\``;
  }

  /**
   * Format file content
   */
  private formatFileContent(filePath: string, content: string): string {
    const lines = content.split('\n').length;
    return `📄 **${filePath}** (${lines} lines)

\`\`\`typescript
${content}
\`\`\``;
  }

  /**
   * Format error message
   */
  private formatError(error: any): string {
    return `❌ **Error**

${error.message}

\`\`\`
${error.stack || ''}
\`\`\``;
  }

  /**
   * Get deployment status
   */
  private async getDeploymentStatus(): Promise<string> {
    try {
      const branch = await this.executeCommand('git branch --show-current');
      const lastCommit = await this.executeCommand('git log -1 --oneline');
      return `On branch ${branch}, last commit: ${lastCommit}`;
    } catch {
      return 'Unable to determine deployment status';
    }
  }
}
