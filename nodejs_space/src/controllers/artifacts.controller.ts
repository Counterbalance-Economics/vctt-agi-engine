
import { Controller, Get, Post, Delete, Param, Body, Query, Logger, ParseIntPipe } from '@nestjs/common';
import { ArtifactsService } from '../services/artifacts.service';
import { CreateArtifactDto, ArtifactResponseDto } from '../dto/artifact.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('Artifacts')
@Controller('api/artifacts')
export class ArtifactsController {
  private readonly logger = new Logger(ArtifactsController.name);

  constructor(private readonly artifactsService: ArtifactsService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create a new artifact',
    description: 'Store a build output, URL, file, or other deliverable for a goal'
  })
  @ApiResponse({ status: 201, description: 'Artifact created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async createArtifact(@Body() dto: CreateArtifactDto): Promise<ArtifactResponseDto> {
    this.logger.log(`POST /api/artifacts - Creating artifact for goal ${dto.goalId}`);
    return await this.artifactsService.createArtifact(dto);
  }

  @Get('goal/:goalId')
  @ApiOperation({ 
    summary: 'Get all artifacts for a goal',
    description: 'Retrieve all completed builds and deliverables for a specific goal'
  })
  @ApiParam({ name: 'goalId', description: 'Goal ID', type: Number })
  @ApiResponse({ status: 200, description: 'Artifacts retrieved successfully' })
  async getArtifactsByGoal(@Param('goalId', ParseIntPipe) goalId: number): Promise<ArtifactResponseDto[]> {
    this.logger.log(`GET /api/artifacts/goal/${goalId}`);
    return await this.artifactsService.getArtifactsByGoal(goalId);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get artifact by ID',
    description: 'Retrieve a specific artifact by its ID'
  })
  @ApiParam({ name: 'id', description: 'Artifact ID', type: Number })
  @ApiResponse({ status: 200, description: 'Artifact retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Artifact not found' })
  async getArtifactById(@Param('id', ParseIntPipe) id: number): Promise<ArtifactResponseDto> {
    this.logger.log(`GET /api/artifacts/${id}`);
    return await this.artifactsService.getArtifactById(id);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get all artifacts with pagination',
    description: 'Retrieve all artifacts across all goals with pagination support'
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20)' })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Filter by artifact type' })
  @ApiResponse({ status: 200, description: 'Artifacts retrieved successfully' })
  async getAllArtifacts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
  ): Promise<any> {
    this.logger.log(`GET /api/artifacts - page=${page}, limit=${limit}, type=${type}`);

    if (type) {
      const artifacts = await this.artifactsService.getArtifactsByType(type);
      return { artifacts, total: artifacts.length };
    }

    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 20;

    return await this.artifactsService.getAllArtifacts(pageNum, limitNum);
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete an artifact',
    description: 'Remove an artifact from the system'
  })
  @ApiParam({ name: 'id', description: 'Artifact ID', type: Number })
  @ApiResponse({ status: 200, description: 'Artifact deleted successfully' })
  @ApiResponse({ status: 404, description: 'Artifact not found' })
  async deleteArtifact(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    this.logger.log(`DELETE /api/artifacts/${id}`);
    await this.artifactsService.deleteArtifact(id);
    return { message: 'Artifact deleted successfully' };
  }

  @Get('stats/overview')
  @ApiOperation({ 
    summary: 'Get artifact statistics',
    description: 'Get overview of all artifacts, grouped by type'
  })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getArtifactStats(): Promise<any> {
    this.logger.log('GET /api/artifacts/stats/overview');
    return await this.artifactsService.getArtifactStats();
  }
}
