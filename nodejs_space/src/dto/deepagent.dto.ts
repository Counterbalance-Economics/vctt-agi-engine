
import { IsString, IsOptional } from 'class-validator';

/**
 * DeepAgent command request DTO
 */
export class DeepAgentCommandDto {
  @IsString()
  input: string;

  @IsString()
  @IsOptional()
  session_id?: string;
}

/**
 * DeepAgent response DTO
 */
export interface DeepAgentResponseDto {
  output: string;
  timestamp: string;
  execution_time_ms: number;
}
