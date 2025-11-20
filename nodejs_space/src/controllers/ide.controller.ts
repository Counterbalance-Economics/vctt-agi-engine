
/**
 * IDE Controller - REST API for IDE operations (Phase 3.5)
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { IdeService } from '../services/ide.service';
import {
  FileOperationDto,
  CodeEditDto,
  TestRunDto,
  DeploymentDto,
  CodeAnalysisDto,
  FileTreeDto,
  ImagePreviewDto,
} from '../dto/ide.dto';

@ApiTags('IDE Operations')
@Controller('api/ide')
export class IdeController {
  private readonly logger = new Logger(IdeController.name);

  constructor(private readonly ideService: IdeService) {}

  @Get('file-tree')
  @ApiOperation({
    summary: 'Get file tree structure',
    description: 'Returns the project file tree with configurable depth',
  })
  @ApiQuery({ name: 'rootPath', required: false, type: String })
  @ApiQuery({ name: 'depth', required: false, type: Number })
  @ApiQuery({ name: 'includeHidden', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'File tree retrieved successfully',
  })
  async getFileTree(
    @Query('rootPath') rootPath?: string,
    @Query('depth') depth?: number,
    @Query('includeHidden') includeHidden?: boolean,
  ) {
    try {
      return await this.ideService.getFileTree(
        rootPath,
        depth || 3,
        includeHidden || false,
      );
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('file-operation')
  @ApiOperation({
    summary: 'Perform file operation',
    description: 'Create, delete, rename, move, read, or write files',
  })
  @ApiBody({ type: FileOperationDto })
  @ApiResponse({
    status: 200,
    description: 'File operation completed successfully',
  })
  async performFileOperation(@Body() dto: FileOperationDto) {
    try {
      return await this.ideService.performFileOperation(
        dto.operation,
        dto.path,
        {
          newPath: dto.newPath,
          content: dto.content,
          isDirectory: dto.isDirectory,
        },
      );
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('code-edit')
  @ApiOperation({
    summary: '🎨 AI Code Editing - MIN Autonomous Engine + Jazz Team (Cmd+K)',
    description: `Transform code using MIN's full autonomous pipeline with self-improvement:
    
    **Phase 1: Autonomous Code Generation**
    - 5-model committee reasoning (Analyst, Relational, Ethics, Planner)
    - Grok-4.1 real-time verification
    - Truth Mycelium best practices
    - Post-synthesis correctness checks
    
    **Phase 2: Jazz Team Analysis (NEW!)**
    - Voice (logical coherence): 0-1 score
    - Choice (emotional balance): 0-1 score
    - Transparency (clarity): 0-1 score
    - Enhanced Trust τ: Verified by jazz team debate
    - Actionable suggestions for improvement
    - Optional refined instruction prompts
    
    This is MIN's UNIQUE ADVANTAGE over Cursor: Not only do we use multi-agent reasoning instead of direct Claude calls, but the agents analyze and improve their own outputs in real-time. This creates a self-evolving system that gets better with every code edit.`,
  })
  @ApiBody({
    type: CodeEditDto,
    examples: {
      'async-conversion': {
        value: {
          filePath: 'src/utils.ts',
          originalCode: 'function fetchData() { return fetch("/api/data"); }',
          instruction: 'make this async/await and add error handling',
          language: 'typescript',
        },
      },
      'refactor': {
        value: {
          filePath: 'src/component.tsx',
          originalCode: 'const MyComponent = () => { const [count, setCount] = useState(0); return <div>{count}</div>; }',
          instruction: 'convert to TypeScript with proper types',
          language: 'tsx',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: `Code transformed successfully. Returns:
    - editedCode: Transformed code
    - originalCode: Original input
    - verification: { trustTau, grokConfidence, verifiedBy, timestamp }
    - stats: { latencyMs, totalCost, modelsUsed }
    - jazzAnalysis (NEW!): { analysis: { voice, choice, transparency, trust }, suggestions: [...], refinedInstruction }
    
    The jazzAnalysis object contains the jazz team's self-improvement analysis with Voice/Choice/Transparency/Trust scores (0-1), actionable suggestions, and optionally a refined instruction prompt for better results.`,
  })
  async applyCodeEdit(@Body() dto: CodeEditDto) {
    try {
      this.logger.log(`🎨 Code edit request: ${dto.filePath} - "${dto.instruction}"`);
      return await this.ideService.applyCodeEdit(
        dto.filePath,
        dto.instruction,
        dto.originalCode,
        dto.language,
      );
    } catch (error) {
      this.logger.error(`❌ Code edit failed: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('run-tests')
  @ApiOperation({
    summary: 'Run test suite',
    description: 'Execute tests with optional path or custom command',
  })
  @ApiBody({ type: TestRunDto })
  @ApiResponse({
    status: 200,
    description: 'Test execution completed',
  })
  async runTests(@Body() dto: TestRunDto) {
    try {
      return await this.ideService.runTests(dto.testPath, dto.testCommand);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('code-analysis')
  @ApiOperation({
    summary: 'Analyze code',
    description: 'Run linting, security checks, performance analysis, or get suggestions',
  })
  @ApiBody({ type: CodeAnalysisDto })
  @ApiResponse({
    status: 200,
    description: 'Code analysis completed',
  })
  async analyzeCode(@Body() dto: CodeAnalysisDto) {
    try {
      return await this.ideService.analyzeCode(dto.filePath, dto.analysisType);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('deployment-status')
  @ApiOperation({
    summary: 'Get deployment status',
    description: 'Check current deployment status and branch information',
  })
  @ApiResponse({
    status: 200,
    description: 'Deployment status retrieved',
  })
  async getDeploymentStatus() {
    try {
      return await this.ideService.getDeploymentStatus();
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('deploy')
  @ApiOperation({
    summary: 'Trigger deployment',
    description: 'Initiate deployment to preview or production environment',
  })
  @ApiBody({ type: DeploymentDto })
  @ApiResponse({
    status: 200,
    description: 'Deployment initiated',
  })
  async triggerDeployment(@Body() dto: DeploymentDto) {
    try {
      return await this.ideService.triggerDeployment(
        dto.environment,
        dto.branch,
      );
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('image-preview')
  @ApiOperation({
    summary: 'Get image preview',
    description: 'Get base64-encoded image for preview',
  })
  @ApiQuery({ name: 'filePath', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Image preview retrieved',
  })
  async getImagePreview(@Query('filePath') filePath: string) {
    try {
      return await this.ideService.getImagePreview(filePath);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('search-files')
  @ApiOperation({
    summary: 'Search in files',
    description: 'Search for text across all project files (Cmd+Shift+F)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        caseSensitive: { type: 'boolean', default: false },
        useRegex: { type: 'boolean', default: false },
        maxResults: { type: 'number', default: 100 },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved',
  })
  async searchFiles(@Body() body: any) {
    try {
      return await this.ideService.searchFiles(
        body.query,
        body.caseSensitive || false,
        body.useRegex || false,
        body.maxResults || 100,
      );
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
