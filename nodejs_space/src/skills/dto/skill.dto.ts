
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsObject, IsArray, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class CreateSkillDto {
  @ApiProperty({ description: 'Skill name', example: 'DEBUG_TYPESCRIPT_ERROR' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Human-readable description of what the skill does' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Category of skill', example: 'CODE_DEBUGGING' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ description: 'Tags for searchability', type: [String] })
  @IsArray()
  @IsString({ each: true })
  tags: string[];

  @ApiProperty({ description: 'Input schema for the skill', type: 'object' })
  @IsObject()
  inputSchema: Record<string, any>;

  @ApiProperty({ description: 'Step-by-step pattern', type: 'object' })
  @IsObject()
  pattern: Record<string, any>;

  @ApiProperty({ description: 'Expected outcomes and success criteria', type: 'object' })
  @IsObject()
  expectedOutcome: Record<string, any>;

  @ApiProperty({ description: 'Success rate (0-100)', required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  successRate?: number;

  @ApiProperty({ description: 'Number of successful uses', required: false })
  @IsNumber()
  @IsOptional()
  usageCount?: number;
}

export class UpdateSkillDto {
  @ApiProperty({ description: 'Updated description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Updated pattern', required: false, type: 'object' })
  @IsObject()
  @IsOptional()
  pattern?: Record<string, any>;

  @ApiProperty({ description: 'Updated success rate', required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  successRate?: number;

  @ApiProperty({ description: 'Increment usage count', required: false })
  @IsNumber()
  @IsOptional()
  incrementUsage?: number;
}

export class SearchSkillsDto {
  @ApiProperty({ description: 'Search query', required: false })
  @IsString()
  @IsOptional()
  query?: string;

  @ApiProperty({ description: 'Filter by category', required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ description: 'Filter by tags', required: false, type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({ description: 'Minimum success rate', required: false })
  @IsNumber()
  @IsOptional()
  minSuccessRate?: number;

  @ApiProperty({ description: 'Result limit', required: false, default: 20 })
  @IsNumber()
  @IsOptional()
  limit?: number;
}
