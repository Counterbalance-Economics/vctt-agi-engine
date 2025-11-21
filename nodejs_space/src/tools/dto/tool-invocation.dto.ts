
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsObject, IsEnum, IsOptional } from 'class-validator';

export enum ToolName {
  READ_FILE = 'READ_FILE',
  WRITE_FILE = 'WRITE_FILE',
  RUN_COMMAND = 'RUN_COMMAND',
  SEARCH_WEB = 'SEARCH_WEB',
  CALL_LLM = 'CALL_LLM',
  QUERY_DB = 'QUERY_DB',
  SCHEDULE_TASK = 'SCHEDULE_TASK',
}

export class InvokeToolDto {
  @ApiProperty({ enum: ToolName, description: 'Tool to invoke' })
  @IsEnum(ToolName)
  @IsNotEmpty()
  tool: ToolName;

  @ApiProperty({ description: 'Tool input parameters', type: Object })
  @IsObject()
  @IsNotEmpty()
  input: Record<string, any>;

  @ApiProperty({ description: 'Justification for tool use', required: false })
  @IsString()
  @IsOptional()
  justification?: string;

  @ApiProperty({ description: 'Conversation or task context', required: false })
  @IsString()
  @IsOptional()
  context?: string;
}

export class ToolInvocationResponseDto {
  @ApiProperty()
  invocationId: string;

  @ApiProperty({ enum: ToolName })
  tool: ToolName;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: Object })
  output: Record<string, any>;

  @ApiProperty()
  executionTimeMs: number;

  @ApiProperty()
  timestamp: Date;

  @ApiProperty({ required: false })
  error?: string;
}
