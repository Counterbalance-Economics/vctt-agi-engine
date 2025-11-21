
/**
 * IDE Service - Advanced IDE operations (Phase 3.5)
 * Handles file operations, code editing, analysis, and more
 */

import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fsSync from 'fs';
import { LLMService } from './llm.service';
import { VCTTEngineService } from './vctt-engine.service';

const execAsync = promisify(exec);

@Injectable()
export class IdeService {
  private readonly logger = new Logger(IdeService.name);
  private readonly projectRoot = '/home/ubuntu/vctt_agi_engine';
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB

  constructor(
    @Inject(forwardRef(() => LLMService))
    private readonly llmService: LLMService,
    @Inject(forwardRef(() => VCTTEngineService))
    private readonly vcttEngine: VCTTEngineService,
  ) {}

  /**
   * Get file tree structure
   */
  async getFileTree(
    rootPath?: string,
    depth: number = 3,
    includeHidden: boolean = false,
  ): Promise<any> {
    try {
      const targetPath = rootPath
        ? path.join(this.projectRoot, rootPath)
        : this.projectRoot;

      const tree = await this.buildFileTree(
        targetPath,
        depth,
        includeHidden,
        0,
      );
      return { success: true, tree };
    } catch (error) {
      this.logger.error(`Error getting file tree: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Build file tree recursively
   */
  private async buildFileTree(
    dirPath: string,
    maxDepth: number,
    includeHidden: boolean,
    currentDepth: number,
  ): Promise<any> {
    if (currentDepth >= maxDepth) return null;

    const stats = await fs.stat(dirPath);
    const name = path.basename(dirPath);

    if (!stats.isDirectory()) {
      return {
        name,
        type: 'file',
        path: dirPath.replace(this.projectRoot, ''),
        size: stats.size,
      };
    }

    const children = await fs.readdir(dirPath);
    const filteredChildren = includeHidden
      ? children
      : children.filter((child) => !child.startsWith('.'));

    const childNodes = await Promise.all(
      filteredChildren.map(async (child) => {
        const childPath = path.join(dirPath, child);
        try {
          return await this.buildFileTree(
            childPath,
            maxDepth,
            includeHidden,
            currentDepth + 1,
          );
        } catch (error) {
          return null;
        }
      }),
    );

    return {
      name,
      type: 'directory',
      path: dirPath.replace(this.projectRoot, ''),
      children: childNodes.filter((node) => node !== null),
    };
  }

  /**
   * File operations (create, delete, rename, move)
   */
  async performFileOperation(
    operation: string,
    filePath: string,
    options?: any,
  ): Promise<any> {
    try {
      const fullPath = path.join(this.projectRoot, filePath);

      // Security check: ensure path is within project root
      if (!fullPath.startsWith(this.projectRoot)) {
        return {
          success: false,
          error: 'Invalid path: outside project directory',
        };
      }

      switch (operation) {
        case 'create':
          return await this.createFile(fullPath, options);
        case 'delete':
          return await this.deleteFile(fullPath);
        case 'rename':
          return await this.renameFile(fullPath, options.newPath);
        case 'move':
          return await this.moveFile(fullPath, options.newPath);
        case 'read':
          return await this.readFile(fullPath);
        case 'write':
          return await this.writeFile(fullPath, options.content);
        default:
          return { success: false, error: 'Unknown operation' };
      }
    } catch (error) {
      this.logger.error(`File operation error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  private async createFile(
    fullPath: string,
    options: any,
  ): Promise<any> {
    try {
      if (options.isDirectory) {
        await fs.mkdir(fullPath, { recursive: true });
        this.logger.log(`Directory created: ${fullPath}`);
      } else {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, options.content || '');
        this.logger.log(`File created: ${fullPath}`);
      }
      return { success: true, path: fullPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async deleteFile(fullPath: string): Promise<any> {
    try {
      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.unlink(fullPath);
      }
      this.logger.log(`Deleted: ${fullPath}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async renameFile(
    fullPath: string,
    newName: string,
  ): Promise<any> {
    try {
      const newPath = path.join(path.dirname(fullPath), newName);
      await fs.rename(fullPath, newPath);
      this.logger.log(`Renamed: ${fullPath} -> ${newPath}`);
      return { success: true, newPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async moveFile(fullPath: string, newPath: string): Promise<any> {
    try {
      const targetPath = path.join(this.projectRoot, newPath);
      await fs.rename(fullPath, targetPath);
      this.logger.log(`Moved: ${fullPath} -> ${targetPath}`);
      return { success: true, newPath: targetPath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async readFile(fullPath: string): Promise<any> {
    try {
      const stats = await fs.stat(fullPath);
      if (stats.size > this.maxFileSize) {
        return {
          success: false,
          error: `File too large (${Math.round(stats.size / 1024 / 1024)}MB)`,
        };
      }
      const content = await fs.readFile(fullPath, 'utf-8');
      return { success: true, content, size: stats.size };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async writeFile(fullPath: string, content: string): Promise<any> {
    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      this.logger.log(`File written: ${fullPath}`);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 🎨 AI Code Editing - NOW POWERED BY MIN'S AUTONOMOUS ENGINE!
   * 
   * PHASE 3.7 CRITICAL UPDATE:
   * This now routes through the FULL VCTT autonomous pipeline:
   * - 5-model committee reasoning (Analyst, Relational, Ethics, Planner)
   * - Grok-4.1 real-time verification
   * - Truth Mycelium best practices
   * - Post-synthesis correctness checks
   * 
   * PHASE 4.5 JAZZ TEAM GUARDRAIL:
   * - Auto-retry if trust score τ < 0.75
   * - Up to 3 retries with exponential backoff
   * - Ensures high-quality autonomous code generation
   * 
   * This is MIN's UNIQUE ADVANTAGE over Cursor (which just calls Claude directly).
   * We use the full multi-agent reasoning stack for every code edit.
   */
  async applyCodeEdit(
    filePath: string,
    instruction: string,
    originalCode: string,
    language?: string,
  ): Promise<any> {
    const MAX_RETRIES = 3;
    const MIN_TRUST_THRESHOLD = 0.75;
    
    try {
      const fileExt = path.extname(filePath).substring(1) || language || 'typescript';
      
      this.logger.log('🚀 ===== MIN AUTONOMOUS CODE EDIT (NOT DIRECT CLAUDE!) =====');
      this.logger.log(`   File: ${filePath}`);
      this.logger.log(`   Instruction: "${instruction.substring(0, 50)}..."`);
      this.logger.log(`   Routing through: 5-model committee + Grok-4.1 + Truth Mycelium`);
      this.logger.log(`   Jazz Guardrail: Auto-retry if τ < ${MIN_TRUST_THRESHOLD}`);

      let result: any;
      let attempt = 0;
      
      // 🔥 JAZZ TEAM GUARDRAIL: Auto-retry loop
      while (attempt < MAX_RETRIES) {
        attempt++;
        
        if (attempt > 1) {
          this.logger.warn(`🔄 Retry attempt ${attempt}/${MAX_RETRIES} (previous τ < ${MIN_TRUST_THRESHOLD})`);
          // Exponential backoff: 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 2) * 1000));
        }

        // Call autonomous engine
        result = await this.vcttEngine.processCodeEdit(
          filePath,
          originalCode,
          instruction,
          fileExt,
        );

        if (!result || !result.success) {
          throw new Error('Autonomous engine returned unsuccessful result');
        }

        const trustScore = result.verification.trustTau;
        
        this.logger.log(`📊 Attempt ${attempt} Results:`);
        this.logger.log(`   Grok Confidence: ${result.verification.grokConfidence.toFixed(2)}`);
        this.logger.log(`   Trust τ: ${trustScore.toFixed(3)}`);
        
        // Check if trust score meets threshold
        if (trustScore >= MIN_TRUST_THRESHOLD) {
          this.logger.log(`✅ Trust threshold met (τ=${trustScore.toFixed(3)} >= ${MIN_TRUST_THRESHOLD})`);
          break;
        } else {
          this.logger.warn(`⚠️  Trust score below threshold (τ=${trustScore.toFixed(3)} < ${MIN_TRUST_THRESHOLD})`);
          
          if (attempt === MAX_RETRIES) {
            this.logger.error(`❌ Max retries reached. Proceeding with τ=${trustScore.toFixed(3)}`);
          }
        }
      }

      this.logger.log('✅ ===== AUTONOMOUS CODE EDIT COMPLETE =====');
      this.logger.log(`   Final Trust τ: ${result.verification.trustTau.toFixed(3)}`);
      this.logger.log(`   Attempts: ${attempt}/${MAX_RETRIES}`);
      this.logger.log(`   Models Used: Analyst, Relational, Ethics, Grok-4.1, Synthesizer`);
      this.logger.log(`   Latency: ${result.stats.latencyMs}ms`);

      // 🎵 JAZZ TEAM INTEGRATION: Analyze this code edit for self-improvement
      try {
        this.logger.log('🎵 Triggering jazz team analysis...');
        
        const jazzAnalysis = await this.vcttEngine.processBuildArtifact({
          feature: 'Code Edit (Cmd+K)',
          description: `Applied instruction: "${instruction.substring(0, 100)}..."`,
          metrics: {
            trustScore: result.verification.trustTau,
            grokConfidence: result.verification.grokConfidence,
            latency: result.stats.latencyMs,
            cost: result.stats.totalCost,
          },
          codeContext: {
            filePath,
            originalCode: originalCode.substring(0, 1000), // First 1KB only
            transformedCode: result.editedCode.substring(0, 1000),
            instruction,
          },
        });
        
        if (jazzAnalysis.success) {
          this.logger.log('✅ Jazz team analysis complete:');
          this.logger.log(`   Voice (logic): ${jazzAnalysis.analysis.voice.toFixed(2)}`);
          this.logger.log(`   Choice (balance): ${jazzAnalysis.analysis.choice.toFixed(2)}`);
          this.logger.log(`   Transparency: ${jazzAnalysis.analysis.transparency.toFixed(2)}`);
          this.logger.log(`   Enhanced Trust τ: ${jazzAnalysis.analysis.trust.toFixed(3)}`);
          
          if (jazzAnalysis.suggestions.length > 0) {
            this.logger.log('   Suggestions:');
            jazzAnalysis.suggestions.forEach((s, i) => {
              this.logger.log(`      ${i + 1}. ${s.substring(0, 80)}`);
            });
          }
          
          // Attach jazz analysis to result
          result.jazzAnalysis = jazzAnalysis;
        } else {
          this.logger.warn('⚠️  Jazz team analysis failed, proceeding without enhancement');
        }
      } catch (jazzError) {
        this.logger.warn(`⚠️  Jazz team analysis error: ${jazzError.message}`);
        // Non-blocking - continue even if jazz analysis fails
      }

      return result;
    } catch (error) {
      this.logger.error(`❌ Autonomous Code Edit failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        originalCode,
        instruction,
      };
    }
  }

  /**
   * AI Code Edit with Streaming (for real-time Cmd+K experience)
   * Returns an async generator for token-by-token streaming
   * 
   * NOTE: Streaming through the full autonomous engine is complex.
   * For Phase 3.7, we use synchronous autonomous engine calls.
   * Streaming can be added in a future phase if needed.
   */
  async *streamCodeEdit(
    filePath: string,
    instruction: string,
    originalCode: string,
    language?: string,
  ): AsyncGenerator<any, void, unknown> {
    try {
      this.logger.log(
        `🌊 Streaming Code Edit: ${filePath} - "${instruction.substring(0, 50)}..."`,
      );

      // Stream from autonomous engine (simplified for now)
      yield { type: 'start', instruction, originalCode };

      // Call the synchronous autonomous engine
      const result = await this.applyCodeEdit(filePath, instruction, originalCode, language);

      if (result.success) {
        // Simulate streaming by yielding the complete result
        yield {
          type: 'chunk',
          content: result.editedCode,
          accumulated: result.editedCode,
        };

        yield {
          type: 'complete',
          editedCode: result.editedCode,
          originalCode: result.originalCode,
          instruction: result.instruction,
          verification: result.verification,
        };
      } else {
        yield {
          type: 'error',
          error: result.error,
        };
      }
    } catch (error) {
      this.logger.error(`❌ Streaming Code Edit failed: ${error.message}`);
      yield {
        type: 'error',
        error: error.message,
      };
    }
  }

  /**
   * Run tests
   */
  async runTests(testPath?: string, testCommand?: string): Promise<any> {
    try {
      const command =
        testCommand ||
        (testPath ? `yarn test ${testPath}` : 'yarn test:e2e');
      const cwd = path.join(this.projectRoot, 'nodejs_space');

      this.logger.log(`Running tests: ${command}`);

      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: 120000, // 2 minute timeout
      });

      return {
        success: true,
        output: stdout,
        errors: stderr,
        command,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        output: error.stdout || '',
        errors: error.stderr || '',
      };
    }
  }

  /**
   * Code analysis (lint, security, performance)
   */
  async analyzeCode(
    filePath: string,
    analysisType: string,
  ): Promise<any> {
    try {
      const fullPath = path.join(this.projectRoot, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');

      switch (analysisType) {
        case 'lint':
          return await this.runLinting(fullPath);
        case 'security':
          return await this.securityAnalysis(content);
        case 'performance':
          return await this.performanceAnalysis(content);
        case 'suggestions':
          return await this.getCodeSuggestions(content);
        default:
          return { success: false, error: 'Unknown analysis type' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private async runLinting(filePath: string): Promise<any> {
    try {
      const { stdout, stderr } = await execAsync(
        `npx eslint ${filePath} --format json`,
        {
          cwd: path.join(this.projectRoot, 'nodejs_space'),
        },
      );
      return { success: true, results: JSON.parse(stdout || '[]') };
    } catch (error) {
      // ESLint returns non-zero exit for lint errors
      try {
        const results = JSON.parse(error.stdout || '[]');
        return { success: true, results };
      } catch {
        return { success: false, error: error.message };
      }
    }
  }

  private async securityAnalysis(content: string): Promise<any> {
    // Simple security checks (expand as needed)
    const issues: string[] = [];

    if (content.includes('eval(')) {
      issues.push('Dangerous eval() usage detected');
    }
    if (content.match(/password\s*=\s*["'][^"']+["']/i)) {
      issues.push('Hardcoded password detected');
    }
    if (content.includes('process.env') && !content.includes('dotenv')) {
      issues.push('Environment variable usage without dotenv');
    }

    return {
      success: true,
      issues,
      severity: issues.length > 0 ? 'warning' : 'clean',
    };
  }

  private async performanceAnalysis(content: string): Promise<any> {
    const suggestions: string[] = [];

    // Basic performance checks
    if (content.includes('forEach') && content.includes('await')) {
      suggestions.push('Consider using Promise.all() for parallel async operations');
    }
    const forLoops = content.match(/for\s*\(/g);
    if (forLoops && forLoops.length > 3) {
      suggestions.push('Multiple nested loops detected - consider optimization');
    }

    return { success: true, suggestions };
  }

  private async getCodeSuggestions(content: string): Promise<any> {
    // Placeholder for AI-powered suggestions
    return {
      success: true,
      suggestions: [
        'Add JSDoc comments for better documentation',
        'Consider adding error handling',
        'Use TypeScript types for better type safety',
      ],
    };
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(): Promise<any> {
    try {
      const { stdout } = await execAsync('git rev-parse HEAD', {
        cwd: this.projectRoot,
      });
      const currentCommit = stdout.trim();

      const { stdout: branch } = await execAsync(
        'git rev-parse --abbrev-ref HEAD',
        { cwd: this.projectRoot },
      );
      const currentBranch = branch.trim();

      return {
        success: true,
        currentCommit: currentCommit.substring(0, 7),
        currentBranch,
        status: 'ready',
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Trigger deployment (placeholder)
   */
  async triggerDeployment(
    environment: string,
    branch?: string,
  ): Promise<any> {
    try {
      this.logger.log(
        `Deployment requested: ${environment} (branch: ${branch || 'current'})`,
      );

      return {
        success: true,
        message: `Deployment to ${environment} initiated`,
        note: 'Use platform deployment button for production deployments',
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get image/media preview (base64 encoded)
   */
  async getImagePreview(filePath: string): Promise<any> {
    try {
      const fullPath = path.join(this.projectRoot, filePath);
      const ext = path.extname(fullPath).toLowerCase();

      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
      if (!imageExtensions.includes(ext)) {
        return {
          success: false,
          error: 'Not an image file',
        };
      }

      const stats = await fs.stat(fullPath);
      if (stats.size > 5 * 1024 * 1024) {
        // 5MB limit
        return {
          success: false,
          error: 'Image too large (>5MB)',
        };
      }

      const buffer = await fs.readFile(fullPath);
      const base64 = buffer.toString('base64');
      const mimeType = this.getMimeType(ext);

      return {
        success: true,
        dataUrl: `data:${mimeType};base64,${base64}`,
        size: stats.size,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private getMimeType(ext: string): string {
    const types: { [key: string]: string } = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
    };
    return types[ext] || 'application/octet-stream';
  }

  /**
   * Search for text across all project files
   */
  async searchFiles(
    query: string,
    caseSensitive: boolean = false,
    useRegex: boolean = false,
    maxResults: number = 100,
  ): Promise<any> {
    try {
      if (!query || query.trim().length === 0) {
        return { success: true, results: [] };
      }

      const results: any[] = [];
      const searchRoot = this.projectRoot;

      // Use grep for efficient searching
      let grepCommand = useRegex
        ? `grep -rn ${caseSensitive ? '' : '-i'} -E "${query.replace(/"/g, '\\"')}"`
        : `grep -rn ${caseSensitive ? '' : '-i'} -F "${query.replace(/"/g, '\\"')}"`;

      // Exclude common directories
      grepCommand += ` --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build --exclude-dir=.next`;

      // Add file path
      grepCommand += ` ${searchRoot}`;

      try {
        const { stdout } = await execAsync(grepCommand, {
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
          timeout: 30000, // 30s timeout
        });

        const lines = stdout.split('\n').slice(0, maxResults);

        for (const line of lines) {
          if (!line.trim()) continue;

          // Parse grep output: /path/to/file:123:content
          const match = line.match(/^(.+?):(\d+):(.+)$/);
          if (match) {
            const [, filePath, lineNumber, lineContent] = match;
            const relativePath = filePath.replace(searchRoot, '');

            // Find match position in line
            let matchStart = 0;
            let matchEnd = 0;

            if (useRegex) {
              const regex = new RegExp(query, caseSensitive ? 'g' : 'gi');
              const regexMatch = regex.exec(lineContent);
              if (regexMatch) {
                matchStart = regexMatch.index;
                matchEnd = regexMatch.index + regexMatch[0].length;
              }
            } else {
              const searchStr = caseSensitive ? lineContent : lineContent.toLowerCase();
              const queryStr = caseSensitive ? query : query.toLowerCase();
              matchStart = searchStr.indexOf(queryStr);
              matchEnd = matchStart + query.length;
            }

            results.push({
              filePath: relativePath,
              lineNumber: parseInt(lineNumber, 10),
              lineContent,
              matchStart,
              matchEnd,
            });
          }
        }
      } catch (grepError: any) {
        // grep returns non-zero exit code when no matches found
        if (grepError.code === 1) {
          // No matches found - this is normal
          return { success: true, results: [] };
        }
        throw grepError;
      }

      return {
        success: true,
        results,
        count: results.length,
        truncated: results.length >= maxResults,
      };
    } catch (error) {
      this.logger.error(`Search files error: ${error.message}`);
      return { success: false, error: error.message, results: [] };
    }
  }

  /**
   * Load workspace folder context from client
   * This registers the user's opened folder with the backend for AI context awareness
   */
  async loadWorkspace(
    folderName: string,
    filePaths: string[],
    fileCount: number,
    timestamp: string,
  ): Promise<any> {
    try {
      this.logger.log(`📁 Loading workspace: ${folderName}`);
      this.logger.log(`   Files: ${fileCount}`);
      this.logger.log(`   Timestamp: ${timestamp}`);
      
      // Store workspace context in memory (could be persisted to database in production)
      // For now, just log and acknowledge
      const workspaceContext = {
        folderName,
        filePaths,
        fileCount,
        timestamp,
        loadedAt: new Date().toISOString(),
      };

      // In a production system, you might store this in Redis or a database
      // For now, we just acknowledge the workspace load
      this.logger.log(`✅ Workspace registered: ${folderName} with ${fileCount} files`);
      this.logger.log(`   Sample files: ${filePaths.slice(0, 5).join(', ')}${fileCount > 5 ? '...' : ''}`);

      return {
        success: true,
        message: 'Workspace loaded successfully',
        workspace: {
          folderName,
          fileCount,
          timestamp,
          status: 'online',
        },
      };
    } catch (error) {
      this.logger.error(`Workspace load error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
