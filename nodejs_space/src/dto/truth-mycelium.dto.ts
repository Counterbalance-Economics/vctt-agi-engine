
import { ApiProperty } from '@nestjs/swagger';

export class VerifiedFactDto {
  @ApiProperty({ description: 'The verified fact statement' })
  fact: string;

  @ApiProperty({ description: 'Confidence score (0-1)', minimum: 0, maximum: 1 })
  confidence: number;

  @ApiProperty({ description: 'Sources that verified this fact', type: [String] })
  sources: string[];

  @ApiProperty({ description: 'Which agent verified this', example: 'grok-4-0709' })
  verifiedBy: string;

  @ApiProperty({ description: 'When this fact was verified' })
  timestamp: Date;

  @ApiProperty({ description: 'Topic/category', required: false })
  topic?: string;
}

export class TruthMyceliumStatsDto {
  @ApiProperty({ description: 'Total verified facts in the mycelium' })
  totalFacts: number;

  @ApiProperty({ description: 'Average confidence across all facts' })
  avgConfidence: number;

  @ApiProperty({ description: 'Top sources by fact count' })
  topSources: Array<{ source: string; count: number }>;

  @ApiProperty({ description: 'Facts added today' })
  growthToday: number;

  @ApiProperty({ description: 'Oldest fact timestamp', required: false })
  oldestFact: Date | null;

  @ApiProperty({ description: 'Newest fact timestamp', required: false })
  newestFact: Date | null;
}

export class TruthMyceliumHealthDto {
  @ApiProperty({ description: 'Is the mycelium healthy?' })
  healthy: boolean;

  @ApiProperty({ description: 'Number of facts currently cached' })
  cacheSize: number;

  @ApiProperty({ description: 'Mycelium status message' })
  message: string;
}
