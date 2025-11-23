
import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TruthMyceliumService } from '../services/truth-mycelium.service';
import {
  VerifiedFactDto,
  TruthMyceliumStatsDto,
  TruthMyceliumHealthDto,
} from '../dto/truth-mycelium.dto';

@ApiTags('Truth Mycelium')
@Controller('truth-mycelium')
export class TruthMyceliumController {
  private readonly logger = new Logger(TruthMyceliumController.name);

  constructor(private readonly truthMycelium: TruthMyceliumService) {}

  @Get('/')
  @ApiOperation({ summary: '🍄 Get all verified facts from the mycelium' })
  @ApiResponse({
    status: 200,
    description: 'List of all verified facts',
    type: [VerifiedFactDto],
  })
  getAllFacts(): VerifiedFactDto[] {
    return this.truthMycelium.getAllFacts();
  }

  @Get('/stats')
  @ApiOperation({ summary: '📊 Get Truth Mycelium statistics' })
  @ApiResponse({
    status: 200,
    description: 'Statistics about the mycelium growth and health',
    type: TruthMyceliumStatsDto,
  })
  getStats(): TruthMyceliumStatsDto {
    return this.truthMycelium.getStats();
  }

  @Get('/health')
  @ApiOperation({ summary: '❤️ Check Truth Mycelium health' })
  @ApiResponse({
    status: 200,
    description: 'Health status of the mycelium',
    type: TruthMyceliumHealthDto,
  })
  getHealth(): TruthMyceliumHealthDto {
    const healthy = this.truthMycelium.isHealthy();
    const cacheSize = this.truthMycelium.getCacheSize();

    return {
      healthy,
      cacheSize,
      message: healthy
        ? `🍄 Truth Mycelium is healthy with ${cacheSize} verified facts`
        : '⚠️  Truth Mycelium is experiencing issues',
    };
  }
}
