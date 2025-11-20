
import { ApiProperty } from '@nestjs/swagger';

export class StreamChunkDto {
  @ApiProperty({ 
    description: 'Token or text chunk',
    example: 'Hello, ' 
  })
  chunk: string;

  @ApiProperty({ 
    description: 'Model generating the response',
    example: 'gpt-4o' 
  })
  model: string;

  @ApiProperty({ 
    description: 'Cumulative tokens used so far',
    example: 150 
  })
  tokensUsed: number;

  @ApiProperty({ 
    description: 'Estimated cost so far (USD)',
    example: 0.0023 
  })
  estimatedCost: number;

  @ApiProperty({ 
    description: 'Timestamp of this chunk',
    example: '2025-11-20T10:30:45.123Z' 
  })
  timestamp: string;
}

export class StreamStartDto {
  @ApiProperty({ 
    description: 'Stream session ID',
    example: 'stream_abc123xyz' 
  })
  sessionId: string;

  @ApiProperty({ 
    description: 'Model being used',
    example: 'gpt-4o' 
  })
  model: string;

  @ApiProperty({ 
    description: 'Agent role (if applicable)',
    example: 'analyst',
    required: false 
  })
  agentRole?: string;

  @ApiProperty({ 
    description: 'Start timestamp',
    example: '2025-11-20T10:30:45.000Z' 
  })
  timestamp: string;
}

export class StreamCompleteDto {
  @ApiProperty({ 
    description: 'Stream session ID',
    example: 'stream_abc123xyz' 
  })
  sessionId: string;

  @ApiProperty({ 
    description: 'Complete generated text',
    example: 'Hello, world! This is the complete response.' 
  })
  fullText: string;

  @ApiProperty({ 
    description: 'Total tokens used',
    example: 245 
  })
  totalTokens: number;

  @ApiProperty({ 
    description: 'Total cost (USD)',
    example: 0.0045 
  })
  totalCost: number;

  @ApiProperty({ 
    description: 'Total latency in milliseconds',
    example: 1523 
  })
  latencyMs: number;

  @ApiProperty({ 
    description: 'Completion timestamp',
    example: '2025-11-20T10:30:46.523Z' 
  })
  timestamp: string;
}

export class StreamErrorDto {
  @ApiProperty({ 
    description: 'Stream session ID',
    example: 'stream_abc123xyz' 
  })
  sessionId: string;

  @ApiProperty({ 
    description: 'Error message',
    example: 'API rate limit exceeded' 
  })
  error: string;

  @ApiProperty({ 
    description: 'Error code',
    example: 'RATE_LIMIT_EXCEEDED',
    required: false 
  })
  code?: string;

  @ApiProperty({ 
    description: 'Error timestamp',
    example: '2025-11-20T10:30:46.000Z' 
  })
  timestamp: string;
}

export class StreamRequestDto {
  @ApiProperty({ 
    description: 'User message to send to LLM',
    example: 'Explain quantum computing in simple terms' 
  })
  message: string;

  @ApiProperty({ 
    description: 'System prompt (optional)',
    example: 'You are a helpful AI assistant.',
    required: false 
  })
  systemPrompt?: string;

  @ApiProperty({ 
    description: 'Temperature for response generation (0-2)',
    example: 0.7,
    required: false,
    minimum: 0,
    maximum: 2 
  })
  temperature?: number;

  @ApiProperty({ 
    description: 'Agent role for model selection',
    example: 'analyst',
    enum: ['analyst', 'relational', 'ethics', 'synthesiser', 'verification'],
    required: false 
  })
  agentRole?: 'analyst' | 'relational' | 'ethics' | 'synthesiser' | 'verification';

  @ApiProperty({ 
    description: 'Enable MCP tools for Claude agents',
    example: true,
    required: false,
    default: true 
  })
  enableTools?: boolean;

  @ApiProperty({ 
    description: 'Conversation history',
    example: [
      { role: 'user', content: 'What is AI?' },
      { role: 'assistant', content: 'AI stands for Artificial Intelligence...' }
    ],
    required: false 
  })
  history?: Array<{ role: string; content: string }>;
}

/**
 * 🎵 PHASE PROGRESS DTO
 * 
 * Emitted during Band Jam Mode to show which phase the band is in.
 * Frontend can use this to display spinners/progress bars.
 */
export class StreamPhaseDto {
  @ApiProperty({ 
    description: 'Current phase of band jam',
    example: 'planner',
    enum: ['planner', 'analyst', 'relational', 'ethics', 'verifier', 'synthesiser', 'complete']
  })
  phase: 'planner' | 'analyst' | 'relational' | 'ethics' | 'verifier' | 'synthesiser' | 'complete';

  @ApiProperty({ 
    description: 'Human-readable phase description',
    example: '🎯 Planner decomposing query...' 
  })
  description: string;

  @ApiProperty({ 
    description: 'Progress percentage (0-100)',
    example: 25,
    minimum: 0,
    maximum: 100 
  })
  progress: number;

  @ApiProperty({ 
    description: 'Agent emoji for visual feedback',
    example: '🎯',
    required: false 
  })
  emoji?: string;

  @ApiProperty({ 
    description: 'Phase status',
    example: 'in_progress',
    enum: ['pending', 'in_progress', 'complete', 'skipped', 'failed']
  })
  status: 'pending' | 'in_progress' | 'complete' | 'skipped' | 'failed';

  @ApiProperty({ 
    description: 'Phase timestamp',
    example: '2025-11-20T10:30:45.123Z' 
  })
  timestamp: string;

  @ApiProperty({ 
    description: 'Session ID',
    example: 'stream_abc123xyz' 
  })
  sessionId: string;
}
