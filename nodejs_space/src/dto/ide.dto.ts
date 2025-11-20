
/**
 * DTOs for IDE-related operations (Phase 3.5)
 */

import { IsString, IsOptional, IsArray, IsBoolean, IsIn, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FileOperationDto {
  @ApiProperty({ enum: ['create', 'delete', 'rename', 'move', 'read', 'write'] })
  @IsIn(['create', 'delete', 'rename', 'move', 'read', 'write'])
  operation: 'create' | 'delete' | 'rename' | 'move' | 'read' | 'write';
  
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  path: string;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  newPath?: string;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;
  
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDirectory?: boolean;
}

export class CodeEditDto {
  @ApiProperty({ description: 'Path to the file being edited' })
  @IsString()
  @IsNotEmpty()
  filePath: string;
  
  @ApiProperty({ description: 'The original code to transform' })
  @IsString()
  @IsNotEmpty()
  originalCode: string;
  
  @ApiProperty({ description: 'Natural language instruction for the transformation' })
  @IsString()
  @IsNotEmpty()
  instruction: string;
  
  @ApiPropertyOptional({ description: 'Programming language (typescript, javascript, python, etc.)' })
  @IsOptional()
  @IsString()
  language?: string;
  
  @ApiPropertyOptional({ description: 'Additional context files' })
  @IsOptional()
  @IsArray()
  context?: string[];
}

export class TestRunDto {
  testPath?: string;
  testCommand?: string;
  watch?: boolean;
}

export class DeploymentDto {
  environment: 'preview' | 'production';
  branch?: string;
  commitMessage?: string;
}

export class CodeAnalysisDto {
  filePath: string;
  analysisType: 'lint' | 'security' | 'performance' | 'suggestions';
}

export class FileTreeDto {
  rootPath?: string;
  depth?: number;
  includeHidden?: boolean;
}

export class ImagePreviewDto {
  filePath: string;
  maxWidth?: number;
  maxHeight?: number;
}
