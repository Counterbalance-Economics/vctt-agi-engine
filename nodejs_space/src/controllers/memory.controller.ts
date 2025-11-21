
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsEnum, IsObject } from 'class-validator';
import { MemoryService, MemoryEntry, MemorySearchOptions } from '../services/memory.service';
import { ConsentManagerService } from '../services/consent-manager.service';
import type { ConsentPreferences } from '../services/consent-manager.service';

class StoreMemoryDto {
  @ApiProperty() 
  @IsString()
  userId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiProperty({ enum: ['conversation', 'learned_fact', 'preference'] })
  @IsEnum(['conversation', 'learned_fact', 'preference'])
  memoryType: 'conversation' | 'learned_fact' | 'preference';

  @ApiProperty()
  @IsString()
  content: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  vcttScore?: number;
}

class GrantConsentDto {
  @ApiProperty()
  @IsString()
  userId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  preferences?: ConsentPreferences;
}

class RevokeConsentDto {
  @ApiProperty()
  @IsString()
  userId: string;
}

@ApiTags('Memory & Consent')
@Controller('api/memory')
export class MemoryController {
  private readonly logger = new Logger(MemoryController.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly consentManager: ConsentManagerService,
  ) {}

  /**
   * Grant consent for memory persistence
   */
  @Post('consent/grant')
  @ApiOperation({ summary: 'Grant consent for memory persistence' })
  @ApiResponse({ status: 200, description: 'Consent granted successfully' })
  async grantConsent(@Body() dto: GrantConsentDto) {
    try {
      const consent = await this.consentManager.grantConsent(
        dto.userId,
        dto.preferences,
      );

      return {
        success: true,
        timestamp: new Date().toISOString(),
        consent,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to grant consent: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Revoke consent for memory persistence
   */
  @Post('consent/revoke')
  @ApiOperation({ summary: 'Revoke consent and delete all memories' })
  @ApiResponse({ status: 200, description: 'Consent revoked successfully' })
  async revokeConsent(@Body() dto: RevokeConsentDto) {
    try {
      // Revoke consent
      const revoked = await this.consentManager.revokeConsent(dto.userId);

      // Delete all memories
      const deletedCount = await this.memoryService.deleteAllMemories(dto.userId);

      return {
        success: revoked,
        timestamp: new Date().toISOString(),
        message: `Consent revoked and ${deletedCount} memories deleted`,
        deletedCount,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to revoke consent: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get consent status for a user
   */
  @Get('consent/:userId')
  @ApiOperation({ summary: 'Get consent status for a user' })
  @ApiResponse({ status: 200, description: 'Consent status retrieved' })
  async getConsent(@Param('userId') userId: string) {
    try {
      const consentInfo = await this.consentManager.getConsentInfo(userId);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        consent: consentInfo || {
          userId,
          consentGiven: false,
          message: 'No consent record found',
        },
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get consent status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Store a memory entry
   */
  @Post('store')
  @ApiOperation({ summary: 'Store a memory entry' })
  @ApiResponse({ status: 201, description: 'Memory stored successfully' })
  async storeMemory(@Body() dto: StoreMemoryDto) {
    try {
      const memory = await this.memoryService.storeMemory(dto);

      if (!memory) {
        return {
          success: false,
          timestamp: new Date().toISOString(),
          message: 'Memory not stored (consent missing or feature disabled)',
        };
      }

      return {
        success: true,
        timestamp: new Date().toISOString(),
        memory,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to store memory: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Retrieve memories for a user
   */
  @Get('retrieve')
  @ApiOperation({ summary: 'Retrieve memories for a user' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'query', required: false, description: 'Semantic search query' })
  @ApiQuery({ name: 'memoryType', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Memories retrieved successfully' })
  async getMemories(
    @Query('userId') userId: string,
    @Query('query') query?: string,
    @Query('memoryType') memoryType?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const options: MemorySearchOptions = {
        userId,
        query,
        memoryType,
        limit: limit ? parseInt(limit, 10) : 50,
      };

      const memories = await this.memoryService.getMemories(options);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        count: memories.length,
        memories,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to retrieve memories: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete a specific memory
   */
  @Delete(':memoryId')
  @ApiOperation({ summary: 'Delete a specific memory' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiResponse({ status: 200, description: 'Memory deleted successfully' })
  async deleteMemory(
    @Param('memoryId') memoryId: string,
    @Query('userId') userId: string,
  ) {
    try {
      const deleted = await this.memoryService.deleteMemory(userId, memoryId);

      return {
        success: deleted,
        timestamp: new Date().toISOString(),
        message: deleted ? 'Memory deleted' : 'Memory not found or deletion failed',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to delete memory: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete all memories for a user (right to deletion)
   */
  @Delete('all/:userId')
  @ApiOperation({ summary: 'Delete all memories for a user (GDPR right to deletion)' })
  @ApiResponse({ status: 200, description: 'All memories deleted' })
  async deleteAllMemories(@Param('userId') userId: string) {
    try {
      const deletedCount = await this.memoryService.deleteAllMemories(userId);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        deletedCount,
        message: `Deleted ${deletedCount} memories`,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to delete memories: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Export all memories for a user
   */
  @Get('export/:userId')
  @ApiOperation({ summary: 'Export all memories for a user (GDPR data portability)' })
  @ApiResponse({ status: 200, description: 'Memories exported' })
  async exportMemories(@Param('userId') userId: string) {
    try {
      const memories = await this.memoryService.exportMemories(userId);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        count: memories.length,
        memories,
        format: 'json',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to export memories: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
