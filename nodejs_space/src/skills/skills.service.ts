
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
    this.logger.log(`Creating new skill: ${dto.name} in category ${dto.category}`);

    const skill = await this.prisma.skills.create({
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        tags: dto.tags,
        inputSchema: dto.inputSchema as any,
        pattern: dto.pattern as any,
        expectedOutcome: dto.expectedOutcome as any,
        successRate: dto.successRate || 0,
        usageCount: dto.usageCount || 0,
        createdBy,
        lastUsed: null,
        metadata: {},
      },
    });

    // Log to autonomy audit
    await this.prisma.autonomyAudit.create({
      data: {
        eventType: 'SKILL_CREATION',
        actorType: 'SYSTEM',
        actorId: createdBy,
        action: `CREATE_SKILL_${dto.category}`,
        targetResource: skill.id,
        outcome: 'SUCCESS',
        metadata: {
          skillName: dto.name,
          category: dto.category,
          tags: dto.tags,
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
    tags?: string[];
    minSuccessRate?: number;
    limit?: number;
  }) {
    const { category, tags, minSuccessRate, limit = 100 } = filters || {};

    return this.prisma.skills.findMany({
      where: {
        ...(category && { category }),
        ...(tags && tags.length > 0 && { tags: { hasSome: tags } }),
        ...(minSuccessRate !== undefined && { successRate: { gte: minSuccessRate } }),
      },
      orderBy: [{ successRate: 'desc' }, { usageCount: 'desc' }],
      take: limit,
    });
  }

  /**
   * Get skill by ID
   */
  async getSkillById(id: string) {
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
    tags?: string[];
    minSuccessRate?: number;
    limit?: number;
  }) {
    const { category, tags, minSuccessRate, limit = 20 } = filters || {};

    this.logger.log(`Searching skills: "${query}"`);

    // Simple text search on name and description
    // In production, use full-text search or vector embeddings
    const skills = await this.prisma.skills.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
            ],
          },
          ...(category ? [{ category }] : []),
          ...(tags && tags.length > 0 ? [{ tags: { hasSome: tags } }] : []),
          ...(minSuccessRate !== undefined ? [{ successRate: { gte: minSuccessRate } }] : []),
        ],
      },
      orderBy: [{ successRate: 'desc' }, { usageCount: 'desc' }],
      take: limit,
    });

    return skills;
  }

  /**
   * Update skill
   */
  async updateSkill(id: string, dto: UpdateSkillDto) {
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
        ...(dto.pattern && { pattern: dto.pattern as any }),
        ...(dto.successRate !== undefined && { successRate: dto.successRate }),
        ...(dto.incrementUsage && { usageCount: { increment: dto.incrementUsage } }),
        lastUsed: new Date(),
      },
    });

    return updatedSkill;
  }

  /**
   * Record skill usage
   */
  async recordSkillUsage(id: string, success: boolean) {
    this.logger.log(`Recording skill usage: ${id} | Success: ${success}`);

    const skill = await this.prisma.skills.findUnique({
      where: { id },
    });

    if (!skill) {
      throw new NotFoundException(`Skill ${id} not found`);
    }

    // Update usage count and recalculate success rate
    const newUsageCount = skill.usageCount + 1;
    const successfulUses = Math.round((skill.successRate / 100) * skill.usageCount);
    const newSuccessfulUses = successfulUses + (success ? 1 : 0);
    const newSuccessRate = (newSuccessfulUses / newUsageCount) * 100;

    const updatedSkill = await this.prisma.skills.update({
      where: { id },
      data: {
        usageCount: newUsageCount,
        successRate: newSuccessRate,
        lastUsed: new Date(),
      },
    });

    // Log to autonomy audit
    await this.prisma.autonomyAudit.create({
      data: {
        eventType: 'SKILL_USAGE',
        actorType: 'SYSTEM',
        actorId: 'skill_tracker',
        action: success ? 'SKILL_SUCCESS' : 'SKILL_FAILURE',
        targetResource: id,
        outcome: success ? 'SUCCESS' : 'FAILED',
        metadata: {
          skillName: skill.name,
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
   * This integrates with the planner to suggest relevant skills
   */
  async getSkillRecommendations(context: {
    task: string;
    category?: string;
    tags?: string[];
    minSuccessRate?: number;
  }) {
    this.logger.log(`Getting skill recommendations for: ${context.task}`);

    // Search for relevant skills
    const skills = await this.searchSkills(context.task, {
      category: context.category,
      tags: context.tags,
      minSuccessRate: context.minSuccessRate || 50,
      limit: 10,
    });

    // Sort by success rate and usage count
    const recommendations = skills
      .map((skill) => ({
        skill,
        relevanceScore: this.calculateRelevanceScore(skill, context.task),
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5)
      .map((r) => r.skill);

    return recommendations;
  }

  /**
   * Calculate relevance score for a skill given a task
   */
  private calculateRelevanceScore(skill: any, task: string): number {
    let score = 0;

    // Base score from success rate
    score += skill.successRate * 0.5;

    // Boost from usage count (up to 20 points)
    score += Math.min(skill.usageCount * 2, 20);

    // Text similarity bonus (simple substring matching)
    const taskLower = task.toLowerCase();
    const nameLower = skill.name.toLowerCase();
    const descLower = skill.description.toLowerCase();

    if (nameLower.includes(taskLower) || taskLower.includes(nameLower)) {
      score += 30;
    }

    if (descLower.includes(taskLower)) {
      score += 15;
    }

    // Tag matching bonus
    const taskWords = taskLower.split(/\s+/);
    const matchingTags = skill.tags.filter((tag: string) =>
      taskWords.some((word) => tag.toLowerCase().includes(word)),
    );
    score += matchingTags.length * 5;

    return score;
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
    const skills = await this.prisma.skills.findMany();

    const avgSuccessRate =
      skills.reduce((sum, s) => sum + s.successRate, 0) / totalSkills || 0;
    const totalUsages = skills.reduce((sum, s) => sum + s.usageCount, 0);

    const topSkills = skills
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 10)
      .map((s) => ({
        name: s.name,
        successRate: s.successRate,
        usageCount: s.usageCount,
      }));

    return {
      totalSkills,
      avgSuccessRate: avgSuccessRate.toFixed(1),
      totalUsages,
      topSkills,
    };
  }
}
