
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsObject, IsArray, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class CreateSkillDto {
  @ApiProperty({ description: 'Skill name', example: 'DEBUG_TYPESCRIPT_ERROR' })
  @IsString()
  @IsNotEmpty()
  skill_name: string;

  @ApiProperty({ description: 'Skill title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Human-readable description of what the skill does' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Category of skill', example: 'CODE_DEBUGGING' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ description: 'Use cases for the skill', type: [String] })
  @IsArray()
  @IsString({ each: true })
  use_cases: string[];

  @ApiProperty({ description: 'Prompt template for the skill' })
  @IsString()
  @IsNotEmpty()
  prompt_template: string;

  @ApiProperty({ description: 'Required context fields', type: [String] })
  @IsArray()
  @IsString({ each: true })
  required_context: string[];

  @ApiProperty({ description: 'Required tools', type: [String] })
  @IsArray()
  @IsString({ each: true })
  required_tools: string[];

  @ApiProperty({ description: 'Approved by', required: false, default: 'system' })
  @IsString()
  @IsOptional()
  approved_by?: string;

  @ApiProperty({ description: 'Skill version', required: false, default: '1.0.0' })
  @IsString()
  @IsOptional()
  skill_version?: string;
}

export class UpdateSkillDto {
  @ApiProperty({ description: 'Updated description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Updated prompt template', required: false })
  @IsString()
  @IsOptional()
  prompt_template?: string;

  @ApiProperty({ description: 'Updated success rate', required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  success_rate?: number;

  @ApiProperty({ description: 'Status', required: false })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ description: 'Refinement notes', required: false })
  @IsString()
  @IsOptional()
  refinement_notes?: string;
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

  @ApiProperty({ description: 'Filter by status', required: false })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ description: 'Minimum success rate', required: false })
  @IsNumber()
  @IsOptional()
  minSuccessRate?: number;

  @ApiProperty({ description: 'Result limit', required: false, default: 20 })
  @IsNumber()
  @IsOptional()
  limit?: number;
}
