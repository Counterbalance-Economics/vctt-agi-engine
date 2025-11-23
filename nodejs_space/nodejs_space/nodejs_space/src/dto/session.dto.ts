
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class StartSessionDto {
  @ApiProperty({
    description: 'User identifier',
    example: 'user_123',
  })
  @IsString()
  @IsNotEmpty()
  user_id: string;

  @ApiProperty({
    description: 'Initial user input/message',
    example: 'What is the meaning of consciousness?',
  })
  @IsString()
  @IsNotEmpty()
  input: string;
}

export class ProcessStepDto {
  @ApiProperty({
    description: 'Session ID',
    example: 'session_1763364545847_al7cvpzvx',
  })
  @IsString()
  @IsNotEmpty()
  session_id: string;

  @ApiProperty({
    description: 'User input/message for this step',
    example: 'Can you explain that in simpler terms?',
  })
  @IsString()
  @IsNotEmpty()
  input: string;
}

export class SessionResponseDto {
  @ApiProperty({
    description: 'Session ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  session_id: string;
}

export class InternalStateDto {
  @ApiProperty({
    description: 'System Intensity Metrics',
    example: { tension: 0.3, uncertainty: 0.2, emotional_intensity: 0.15 },
  })
  sim: {
    tension: number;
    uncertainty: number;
    emotional_intensity: number;
  };

  @ApiProperty({
    description: 'Contradiction score (0.0-1.0)',
    example: 0.25,
  })
  contradiction: number;

  @ApiProperty({
    description: 'Current regulation mode',
    example: 'normal',
    enum: ['normal', 'clarify', 'slow_down'],
  })
  regulation: 'normal' | 'clarify' | 'slow_down';

  @ApiProperty({
    description: 'Trust metric tau (0.0-1.0)',
    example: 0.867,
  })
  trust_tau: number;

  @ApiProperty({
    description: 'Number of repair iterations performed',
    example: 0,
  })
  repair_count: number;
}

export class StepResponseDto {
  @ApiProperty({
    description: 'Generated response from the system',
    example: 'Based on your question about consciousness...',
  })
  response: string;

  @ApiProperty({
    description: 'Current internal state of the system',
    type: InternalStateDto,
  })
  internal_state: InternalStateDto;
}

export class MessageDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'user', enum: ['user', 'assistant', 'system'] })
  role: string;

  @ApiProperty({ example: 'What is consciousness?' })
  content: string;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  timestamp: Date;
}

export class SessionDetailsDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  session_id: string;

  @ApiProperty({ example: 'user_123' })
  user_id: string;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  created_at: Date;

  @ApiProperty({ type: [MessageDto] })
  messages: MessageDto[];

  @ApiProperty({ type: InternalStateDto, nullable: true })
  internal_state: InternalStateDto | null;

  @ApiProperty({ example: '2024-01-15T10:30:00Z', nullable: true })
  last_updated: Date | null;
}
