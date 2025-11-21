
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../services/prisma.service';
import { CreateSkillDto, UpdateSkillDto } from './dto/skill.dto';

@Injectable()
export class SkillsService {
  private readonly logger = new Logger(SkillsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new skill
   */
  async createSkill(dto: CreateSkillDto, createdBy: string = 'system') {
    this.logger.log(`Creating new skill: ${dto.skill_name} in category ${dto.category}`);

    const skill = await this.prisma.skills.create({
      data: {
        skill_name: dto.skill_name,
        skill_version: dto.skill_version || '1.0.0',
        category: dto.category,
        title: dto.title,
        description: dto.description,
        use_cases: dto.use_cases,
        prompt_template: dto.prompt_template,
        required_context: dto.required_context,
        required_tools: dto.required_tools,
        usage_count: 0,
        status: 'active',
        approved_by: dto.approved_by || createdBy,
        approved_at: new Date(),
      },
    });

    // Log to autonomy audit
    await this.prisma.autonomy_audit.create({
      data: {
        eventType: 'SKILL_CREATION',
        actorType: 'SYSTEM',
        actorId: createdBy,
        action: `CREATE_SKILL_${dto.category}`,
        targetResource: skill.id.toString(),
        outcome: 'SUCCESS',
        metadata: {
          skillName: dto.skill_name,
          category: dto.category,
        } as any,
        timestamp: new Date(),
      },
    });

    return skill;
  }

  /**
   * Get all skills
   */
  async getAllSkills(filters?: {
    category?: string;
    status?: string;
    minSuccessRate?: number;
    limit?: number;
  }) {
    const { category, status, minSuccessRate, limit = 100 } = filters || {};

    return this.prisma.skills.findMany({
      where: {
        ...(category && { category }),
        ...(status && { status }),
        ...(minSuccessRate !== undefined && { success_rate: { gte: minSuccessRate } }),
      },
      orderBy: [{ success_rate: 'desc' }, { usage_count: 'desc' }],
      take: limit,
    });
  }

  /**
   * Get skill by ID
   */
  async getSkillById(id: number) {
    const skill = await this.prisma.skills.findUnique({
      where: { id },
    });

    if (!skill) {
      throw new NotFoundException(`Skill ${id} not found`);
    }

    return skill;
  }

  /**
   * Search skills by query
   */
  async searchSkills(query: string, filters?: {
    category?: string;
    status?: string;
    minSuccessRate?: number;
    limit?: number;
  }) {
    const { category, status, minSuccessRate, limit = 20 } = filters || {};

    this.logger.log(`Searching skills: "${query}"`);

    // Simple text search on name and description
    const skills = await this.prisma.skills.findMany({
      where: {
        AND: [
          {
            OR: [
              { skill_name: { contains: query, mode: 'insensitive' } },
              { title: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
          ...(category ? [{ category }] : []),
          ...(status ? [{ status }] : []),
          ...(minSuccessRate !== undefined ? [{ success_rate: { gte: minSuccessRate } }] : []),
        ],
      },
      orderBy: [{ success_rate: 'desc' }, { usage_count: 'desc' }],
      take: limit,
    });

    return skills;
  }

  /**
   * Update skill
   */
  async updateSkill(id: number, dto: UpdateSkillDto) {
    this.logger.log(`Updating skill: ${id}`);

    const skill = await this.prisma.skills.findUnique({
      where: { id },
    });

    if (!skill) {
      throw new NotFoundException(`Skill ${id} not found`);
    }

    const updatedSkill = await this.prisma.skills.update({
      where: { id },
      data: {
        ...(dto.description && { description: dto.description }),
        ...(dto.prompt_template && { prompt_template: dto.prompt_template }),
        ...(dto.success_rate !== undefined && { success_rate: dto.success_rate }),
        ...(dto.status && { status: dto.status }),
        ...(dto.refinement_notes && { refinement_notes: dto.refinement_notes }),
        last_refined_at: new Date(),
      },
    });

    return updatedSkill;
  }

  /**
   * Record skill usage
   */
  async recordSkillUsage(id: number, success: boolean) {
    this.logger.log(`Recording skill usage: ${id} | Success: ${success}`);

    const skill = await this.prisma.skills.findUnique({
      where: { id },
    });

    if (!skill) {
      throw new NotFoundException(`Skill ${id} not found`);
    }

    // Update usage count and recalculate success rate
    const newUsageCount = skill.usage_count + 1;
    const currentRate = skill.success_rate || 0;
    const successfulUses = Math.round((currentRate / 100) * skill.usage_count);
    const newSuccessfulUses = successfulUses + (success ? 1 : 0);
    const newSuccessRate = (newSuccessfulUses / newUsageCount) * 100;

    const updatedSkill = await this.prisma.skills.update({
      where: { id },
      data: {
        usage_count: newUsageCount,
        success_rate: newSuccessRate,
        last_refined_at: new Date(),
      },
    });

    // Log to autonomy audit
    await this.prisma.autonomy_audit.create({
      data: {
        eventType: 'SKILL_USAGE',
        actorType: 'SYSTEM',
        actorId: 'skill_tracker',
        action: success ? 'SKILL_SUCCESS' : 'SKILL_FAILURE',
        targetResource: id.toString(),
        outcome: success ? 'SUCCESS' : 'FAILED',
        metadata: {
          skillName: skill.skill_name,
          newSuccessRate: newSuccessRate.toFixed(1),
          usageCount: newUsageCount,
        } as any,
        timestamp: new Date(),
      },
    });

    return updatedSkill;
  }

  /**
   * Get skill recommendations for a given context
   */
  async getSkillRecommendations(context: {
    task: string;
    category?: string;
    minSuccessRate?: number;
  }) {
    this.logger.log(`Getting skill recommendations for: ${context.task}`);

    // Search for relevant skills
    const skills = await this.searchSkills(context.task, {
      category: context.category,
      status: 'active',
      minSuccessRate: context.minSuccessRate || 50,
      limit: 10,
    });

    return skills.slice(0, 5);
  }

  /**
   * Get skill categories
   */
  async getCategories() {
    const skills = await this.prisma.skills.findMany({
      select: { category: true },
      distinct: ['category'],
    });

    return skills.map((s) => s.category);
  }

  /**
   * Get skill statistics
   */
  async getStatistics() {
    const totalSkills = await this.prisma.skills.count();
    const skills = await this.prisma.skills.findMany({
      where: { status: 'active' },
    });

    const avgSuccessRate =
      skills.reduce((sum, s) => sum + (s.success_rate || 0), 0) / (totalSkills || 1);
    const totalUsages = skills.reduce((sum, s) => sum + s.usage_count, 0);

    const topSkills = skills
      .sort((a, b) => (b.success_rate || 0) - (a.success_rate || 0))
      .slice(0, 10)
      .map((s) => ({
        name: s.skill_name,
        title: s.title,
        successRate: s.success_rate,
        usageCount: s.usage_count,
      }));

    return {
      totalSkills,
      avgSuccessRate: avgSuccessRate.toFixed(1),
      totalUsages,
      topSkills,
    };
  }
}
