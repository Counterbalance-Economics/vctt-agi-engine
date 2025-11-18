
import { IsUUID, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for LLM Committee statistics requests
 */
export class LLMCommitteeQueryDto {
  @ApiProperty({
    description: 'Number of recent questions to analyze (for global stats)',
    example: 50,
    required: false,
    minimum: 1,
    maximum: 500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 50;
}

/**
 * Model statistics for a single LLM
 */
export class ModelStats {
  @ApiProperty({ description: 'Model name', example: 'grok-3' })
  model_name: string;

  @ApiProperty({ description: 'Number of times this model contributed', example: 47 })
  answered: number;

  @ApiProperty({ description: 'Total invocations', example: 50 })
  total: number;

  @ApiProperty({ description: 'Contribution percentage', example: 94.0 })
  percentage: number;

  @ApiProperty({ description: 'Number of offline/error events', example: 3 })
  offline_count: number;

  @ApiProperty({ description: 'Average latency in ms', example: 1250 })
  avg_latency_ms: number;

  @ApiProperty({ description: 'Total cost in USD', example: 0.156 })
  total_cost_usd: number;
}

/**
 * Session-level LLM Committee statistics
 */
export class SessionCommitteeStatsDto {
  @ApiProperty({ description: 'Session ID' })
  session_id: string;

  @ApiProperty({ description: 'Total questions in this session', example: 4 })
  total_questions: number;

  @ApiProperty({ description: 'Statistics per model', type: [ModelStats] })
  models: ModelStats[];

  @ApiProperty({ description: 'Timestamp of query' })
  generated_at: Date;
}

/**
 * Global LLM Committee statistics (last N questions)
 */
export class GlobalCommitteeStatsDto {
  @ApiProperty({ description: 'Number of questions analyzed', example: 50 })
  questions_analyzed: number;

  @ApiProperty({ description: 'Time range start' })
  time_range_start: Date;

  @ApiProperty({ description: 'Time range end' })
  time_range_end: Date;

  @ApiProperty({ description: 'Statistics per model', type: [ModelStats] })
  models: ModelStats[];

  @ApiProperty({ description: 'Timestamp of query' })
  generated_at: Date;
}
