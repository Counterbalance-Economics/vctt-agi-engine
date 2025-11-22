
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../services/prisma.service';

@Injectable()
export class SkillsService {
  private readonly logger = new Logger(SkillsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllSkills(category?: string, status?: string) {
    const where: any = {};
    if (category) where.category = category;
    if (status) where.status = status;

    return this.prisma.skills.findMany({
      where,
      orderBy: [
        { success_rate: 'desc' },
        { usage_count: 'desc' },
      ],
    });
  }

  async getSkillByName(skillName: string) {
    return this.prisma.skills.findUnique({
      where: { skill_name: skillName },
    });
  }

  async createSkill(data: {
    skillName: string;
    category: string;
    title: string;
    description: string;
    useCases: string[];
    promptTemplate: string;
    requiredContext: string[];
    requiredTools: string[];
    approvedBy: string;
  }) {
    this.logger.log(`✅ Skills: Creating new skill: ${data.skillName}`);

    return this.prisma.skills.create({
      data: {
        skill_name: data.skillName,
        category: data.category,
        title: data.title,
        description: data.description,
        use_cases: data.useCases,
        prompt_template: data.promptTemplate,
        required_context: data.requiredContext,
        required_tools: data.requiredTools,
        approved_by: data.approvedBy,
        status: 'active',
        usage_count: 0,
      },
    });
  }

  async updateSkillUsage(skillName: string, success: boolean, trustTau: number, latencyMs: number) {
    const skill = await this.prisma.skills.findUnique({
      where: { skill_name: skillName },
    });

    if (!skill) {
      this.logger.warn(`⚠️  Skills: Cannot update usage for non-existent skill: ${skillName}`);
      return null;
    }

    const newUsageCount = skill.usage_count + 1;
    const currentSuccessRate = skill.success_rate || 0;
    const newSuccessRate = (currentSuccessRate * skill.usage_count + (success ? 1 : 0)) / newUsageCount;

    const currentAvgTau = skill.avg_trust_tau || 0;
    const newAvgTau = (currentAvgTau * skill.usage_count + trustTau) / newUsageCount;

    const currentAvgLatency = skill.avg_latency_ms || 0;
    const newAvgLatency = Math.round((currentAvgLatency * skill.usage_count + latencyMs) / newUsageCount);

    return this.prisma.skills.update({
      where: { skill_name: skillName },
      data: {
        usage_count: newUsageCount,
        success_rate: newSuccessRate,
        avg_trust_tau: newAvgTau,
        avg_latency_ms: newAvgLatency,
      },
    });
  }

  async extractSkillFromEpisodes(skillData: {
    skillName: string;
    category: string;
    title: string;
    description: string;
    useCases: string[];
    promptTemplate: string;
    requiredContext: string[];
    requiredTools: string[];
    extractedFromEvaluationIds: number[];
    approvedBy: string;
  }) {
    this.logger.log(`🧠 Skills: Auto-extracting new skill from ${skillData.extractedFromEvaluationIds.length} episodes`);

    const existing = await this.prisma.skills.findUnique({
      where: { skill_name: skillData.skillName },
    });

    if (existing) {
      this.logger.warn(`⚠️  Skills: Skill ${skillData.skillName} already exists, skipping extraction`);
      return existing;
    }

    return this.prisma.skills.create({
      data: {
        skill_name: skillData.skillName,
        category: skillData.category,
        title: skillData.title,
        description: skillData.description,
        use_cases: skillData.useCases,
        prompt_template: skillData.promptTemplate,
        required_context: skillData.requiredContext,
        required_tools: skillData.requiredTools,
        extracted_from_evaluation_ids: skillData.extractedFromEvaluationIds,
        approved_by: skillData.approvedBy,
        status: 'active',
        usage_count: 0,
      },
    });
  }

  async findSkillCandidates(minTau: number = 0.85, minCount: number = 3) {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const highTauEpisodes = await this.prisma.evaluations.findMany({
      where: {
        evaluated_at: { gte: sevenDaysAgo },
        trust_tau: { gte: minTau },
        success: true,
      },
      orderBy: { trust_tau: 'desc' },
      take: 100,
    });

    const patternMap = new Map<string, any[]>();
    
    for (const episode of highTauEpisodes) {
      const pattern = episode.instruction?.substring(0, 100).toLowerCase() || 'unknown';
      if (!patternMap.has(pattern)) {
        patternMap.set(pattern, []);
      }
      const episodes = patternMap.get(pattern);
      if (episodes) episodes.push(episode);
    }

    const candidates = [];
    for (const [pattern, episodes] of patternMap.entries()) {
      if (episodes.length >= minCount) {
        const avgTau = episodes.reduce((sum, e) => sum + e.trust_tau, 0) / episodes.length;
        candidates.push({
          pattern,
          count: episodes.length,
          avgTau,
          evaluationIds: episodes.map(e => e.id),
          sampleInstructions: episodes.slice(0, 3).map(e => e.instruction),
        });
      }
    }

    return candidates.sort((a, b) => b.avgTau - a.avgTau);
  }

  async deactivateSkill(skillName: string) {
    this.logger.log(`⏸️  Skills: Deactivating skill: ${skillName}`);
    
    return this.prisma.skills.update({
      where: { skill_name: skillName },
      data: { status: 'inactive' },
    });
  }

  async activateSkill(skillName: string) {
    this.logger.log(`▶️  Skills: Activating skill: ${skillName}`);
    
    return this.prisma.skills.update({
      where: { skill_name: skillName },
      data: { status: 'active' },
    });
  }
}
