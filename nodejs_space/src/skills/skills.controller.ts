
import { Controller, Get, Post, Patch, Param, Body, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody, ApiParam } from '@nestjs/swagger';
import { SkillsService } from './skills.service';

@ApiTags('skills')
@Controller('skills')
export class SkillsController {
  private readonly logger = new Logger(SkillsController.name);

  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all skills' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive'] })
  @ApiResponse({ status: 200, description: 'List of skills' })
  async getAllSkills(@Query('category') category?: string, @Query('status') status?: string) {
    return this.skillsService.getAllSkills(category, status);
  }

  @Get('candidates')
  @ApiOperation({ summary: 'Find skill candidates from high-τ episodes' })
  @ApiQuery({ name: 'minTau', required: false, type: 'number' })
  @ApiQuery({ name: 'minCount', required: false, type: 'number' })
  @ApiResponse({ status: 200, description: 'List of skill candidates' })
  async findCandidates(@Query('minTau') minTau?: string, @Query('minCount') minCount?: string) {
    return this.skillsService.findSkillCandidates(
      minTau ? parseFloat(minTau) : 0.85,
      minCount ? parseInt(minCount) : 3,
    );
  }

  @Get(':skillName')
  @ApiOperation({ summary: 'Get skill by name' })
  @ApiParam({ name: 'skillName', type: 'string' })
  @ApiResponse({ status: 200, description: 'Skill details' })
  @ApiResponse({ status: 404, description: 'Skill not found' })
  async getSkill(@Param('skillName') skillName: string) {
    return this.skillsService.getSkillByName(skillName);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new skill' })
  @ApiResponse({ status: 201, description: 'Skill created' })
  async createSkill(@Body() data: any) {
    return this.skillsService.createSkill(data);
  }

  @Post('extract')
  @ApiOperation({ summary: 'Auto-extract skill from high-τ episodes (Coach uses this)' })
  @ApiResponse({ status: 201, description: 'Skill extracted' })
  async extractSkill(@Body() data: any) {
    return this.skillsService.extractSkillFromEpisodes(data);
  }

  @Patch(':skillName/usage')
  @ApiOperation({ summary: 'Update skill usage statistics' })
  @ApiParam({ name: 'skillName', type: 'string' })
  @ApiResponse({ status: 200, description: 'Usage updated' })
  async updateUsage(@Param('skillName') skillName: string, @Body() data: any) {
    return this.skillsService.updateSkillUsage(skillName, data.success, data.trustTau, data.latencyMs);
  }

  @Patch(':skillName/deactivate')
  @ApiOperation({ summary: 'Deactivate a skill' })
  @ApiParam({ name: 'skillName', type: 'string' })
  @ApiResponse({ status: 200, description: 'Skill deactivated' })
  async deactivateSkill(@Param('skillName') skillName: string) {
    return this.skillsService.deactivateSkill(skillName);
  }

  @Patch(':skillName/activate')
  @ApiOperation({ summary: 'Activate a skill' })
  @ApiParam({ name: 'skillName', type: 'string' })
  @ApiResponse({ status: 200, description: 'Skill activated' })
  async activateSkill(@Param('skillName') skillName: string) {
    return this.skillsService.activateSkill(skillName);
  }
}
