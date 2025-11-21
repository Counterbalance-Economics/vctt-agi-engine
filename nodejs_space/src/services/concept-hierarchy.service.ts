
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateConceptDto {
  name: string;
  description?: string;
  parentId?: string;
  vcttScore: number;
}

@Injectable()
export class ConceptHierarchyService {
  private readonly logger = new Logger(ConceptHierarchyService.name);

  constructor(private readonly prisma: PrismaService) {
    this.logger.log('🌳 Concept Hierarchy Service initialized');
  }

  /**
   * Create or update a concept
   */
  async createConcept(dto: CreateConceptDto): Promise<any> {
    try {
      // Check if concept already exists
      const existing = await this.prisma.kg_concept.findUnique({
        where: { name: dto.name },
      });

      if (existing) {
        this.logger.log(`Concept already exists: ${dto.name}`);
        return existing;
      }

      // Calculate level based on parent
      let level = 0;
      if (dto.parentId) {
        const parent = await this.prisma.kg_concept.findUnique({
          where: { id: dto.parentId },
        });
        if (parent) {
          level = parent.level + 1;
        }
      }

      // Create new concept
      return await this.prisma.kg_concept.create({
        data: {
          name: dto.name,
          description: dto.description,
          parent_id: dto.parentId,
          level,
          vctt_score: new Decimal(dto.vcttScore),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create concept: ${error.message}`);
      throw error;
    }
  }

  /**
   * Link entity to concept
   */
  async linkEntityToConcept(
    entityId: string,
    conceptId: string,
    relevance: number,
  ): Promise<any> {
    try {
      // Check if mapping already exists
      const existing = await this.prisma.kg_concept_mapping.findFirst({
        where: {
          entity_id: entityId,
          concept_id: conceptId,
        },
      });

      if (existing) {
        return existing;
      }

      // Create mapping
      return await this.prisma.kg_concept_mapping.create({
        data: {
          entity_id: entityId,
          concept_id: conceptId,
          relevance: new Decimal(relevance),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to link entity to concept: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get concept hierarchy (tree structure)
   */
  async getConceptHierarchy(rootConceptId?: string): Promise<any> {
    const where = rootConceptId ? { id: rootConceptId } : { parent_id: null };

    const roots = await this.prisma.kg_concept.findMany({
      where,
      include: {
        children: {
          include: {
            children: {
              include: {
                children: true,
              },
            },
          },
        },
        entity_mappings: {
          include: {
            entity: true,
          },
        },
      },
    });

    return roots;
  }

  /**
   * Get all entities tagged with a concept
   */
  async getEntitiesByConcept(conceptId: string): Promise<any[]> {
    const mappings = await this.prisma.kg_concept_mapping.findMany({
      where: { concept_id: conceptId },
      include: {
        entity: {
          include: {
            relationships_from: {
              include: {
                to_entity: true,
              },
            },
          },
        },
      },
      orderBy: {
        relevance: 'desc',
      },
    });

    return mappings.map((m) => m.entity);
  }

  /**
   * Get concept path (from root to concept)
   */
  async getConceptPath(conceptId: string): Promise<any[]> {
    const path: any[] = [];
    let currentId: string | null = conceptId;

    while (currentId) {
      const concept: any = await this.prisma.kg_concept.findUnique({
        where: { id: currentId },
      });

      if (!concept) break;

      path.unshift(concept);
      currentId = concept.parent_id;
    }

    return path;
  }

  /**
   * Search concepts by name
   */
  async searchConcepts(query: string, limit: number = 20): Promise<any[]> {
    return await this.prisma.kg_concept.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
      orderBy: {
        vctt_score: 'desc',
      },
    });
  }
}
