
import { Controller, Post, Get, Patch, Body, Query, Param, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SkillsService } from './skills.service';
import { CreateSkillDto, UpdateSkillDto, SearchSkillsDto } from './dto/skill.dto';

@ApiTags('Skills Library')
@Controller('skills')
export class SkillsController {
  private readonly logger = new Logger(SkillsController.name);

  constructor(private readonly skillsService: SkillsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create skill',
    description: 'Add a new proven pattern to the skill library',
  })
  async createSkill(@Body() dto: CreateSkillDto, @Query('createdBy') createdBy?: string) {
    this.logger.log(`Creating skill: ${dto.skill_name}`);
    return this.skillsService.createSkill(dto, createdBy || 'system');
  }

  @Get()
  @ApiOperation({
    summary: 'Get all skills',
    description: 'Retrieve all skills with optional filters',
  })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'minSuccessRate', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getAllSkills(
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('minSuccessRate') minSuccessRate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.skillsService.getAllSkills({
      category,
      status,
      minSuccessRate: minSuccessRate ? parseFloat(minSuccessRate) : undefined,
      limit: limit ? parseInt(limit) : 100,
    });
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search skills',
    description: 'Search for skills by query text',
  })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'minSuccessRate', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async searchSkills(
    @Query('q') query: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('minSuccessRate') minSuccessRate?: string,
    @Query('limit') limit?: string,
  ) {
    return this.skillsService.searchSkills(query, {
      category,
      status,
      minSuccessRate: minSuccessRate ? parseFloat(minSuccessRate) : undefined,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get('recommendations')
  @ApiOperation({
    summary: 'Get skill recommendations',
    description: 'Get skill recommendations for a given task context',
  })
  @ApiQuery({ name: 'task', required: true })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'minSuccessRate', required: false, type: Number })
  async getRecommendations(
    @Query('task') task: string,
    @Query('category') category?: string,
    @Query('minSuccessRate') minSuccessRate?: string,
  ) {
    return this.skillsService.getSkillRecommendations({
      task,
      category,
      minSuccessRate: minSuccessRate ? parseFloat(minSuccessRate) : undefined,
    });
  }

  @Get('categories')
  @ApiOperation({
    summary: 'Get skill categories',
    description: 'Get all unique skill categories',
  })
  async getCategories() {
    return this.skillsService.getCategories();
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Get skill statistics',
    description: 'Get overall skill library statistics',
  })
  async getStatistics() {
    return this.skillsService.getStatistics();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get skill by ID',
    description: 'Retrieve a specific skill by its ID',
  })
  async getSkillById(@Param('id') id: string) {
    return this.skillsService.getSkillById(parseInt(id));
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update skill',
    description: 'Update a skill with new information',
  })
  async updateSkill(@Param('id') id: string, @Body() dto: UpdateSkillDto) {
    this.logger.log(`Updating skill: ${id}`);
    return this.skillsService.updateSkill(parseInt(id), dto);
  }

  @Post(':id/usage')
  @ApiOperation({
    summary: 'Record skill usage',
    description: 'Record that a skill was used and whether it succeeded',
  })
  async recordUsage(@Param('id') id: string, @Query('success') success: string) {
    this.logger.log(`Recording usage for skill: ${id} | Success: ${success}`);
    return this.skillsService.recordSkillUsage(parseInt(id), success === 'true');
  }
}
