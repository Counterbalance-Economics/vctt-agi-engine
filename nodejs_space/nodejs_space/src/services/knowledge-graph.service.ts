
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SafetyStewardAgent } from '../agents/safety-steward.agent';
import { Decimal } from '@prisma/client/runtime/library';

export class CreateEntityDto {
  userId: string;
  name: string;
  type: string;
  description?: string;
  attributes?: Record<string, any>;
  vcttScore: number;
  confidence: number;
  sourceMemoryId?: string;
}

export class CreateRelationshipDto {
  userId: string;
  fromEntityId: string;
  toEntityId: string;
  relationType: string;
  properties?: Record<string, any>;
  vcttScore: number;
  confidence: number;
  sourceMemoryId?: string;
}

export class KnowledgeQueryDto {
  userId: string;
  entityName?: string;
  entityType?: string;
  relationType?: string;
  minVCTTScore?: number;
  limit?: number;
}

@Injectable()
export class KnowledgeGraphService {
  private readonly logger = new Logger(KnowledgeGraphService.name);
  private enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly safetySteward: SafetyStewardAgent,
  ) {
    this.enabled = process.env.KNOWLEDGE_GRAPH_ENABLED === 'true';
    this.logger.log(
      `🕸️  Knowledge Graph Service initialized (Enabled: ${this.enabled})`,
    );
  }

  /**
   * Create or update an entity
   */
  async createEntity(dto: CreateEntityDto): Promise<any> {
    if (!this.enabled) {
      this.logger.warn('Knowledge graph disabled');
      return null;
    }

    // Check with SafetySteward
    const allowed = await this.safetySteward.canPerformOperation('WRITE', dto.userId);
    if (!allowed) {
      this.logger.warn('Entity creation blocked by SafetySteward');
      return null;
    }

    try {
      // Check if entity already exists (deduplication)
      const existing = await this.prisma.kg_entity.findFirst({
        where: {
          user_id: dto.userId,
          name: dto.name,
          type: dto.type,
        },
      });

      if (existing) {
        // Update existing entity
        this.logger.log(`Updating existing entity: ${dto.name}`);
        return await this.prisma.kg_entity.update({
          where: { id: existing.id },
          data: {
            description: dto.description || existing.description,
            attributes: (dto.attributes as any) || existing.attributes,
            vctt_score: new Decimal(Math.max(Number(existing.vctt_score), dto.vcttScore)),
            confidence: new Decimal(Math.max(Number(existing.confidence), dto.confidence)),
            last_updated: new Date(),
          },
        });
      }

      // Create new entity
      this.logger.log(`Creating new entity: ${dto.name} (${dto.type})`);
      return await this.prisma.kg_entity.create({
        data: {
          user_id: dto.userId,
          name: dto.name,
          type: dto.type,
          description: dto.description,
          attributes: dto.attributes as any || {},
          vctt_score: new Decimal(dto.vcttScore),
          confidence: new Decimal(dto.confidence),
          source_memory_id: dto.sourceMemoryId,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create entity: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a relationship between entities
   */
  async createRelationship(dto: CreateRelationshipDto): Promise<any> {
    if (!this.enabled) {
      return null;
    }

    // Check with SafetySteward
    const allowed = await this.safetySteward.canPerformOperation('WRITE', dto.userId);
    if (!allowed) {
      this.logger.warn('Relationship creation blocked by SafetySteward');
      return null;
    }

    try {
      // Check if relationship already exists
      const existing = await this.prisma.kg_relationship.findFirst({
        where: {
          user_id: dto.userId,
          from_entity_id: dto.fromEntityId,
          to_entity_id: dto.toEntityId,
          relation_type: dto.relationType,
        },
      });

      if (existing) {
        this.logger.log(`Relationship already exists: ${dto.fromEntityId} -> ${dto.toEntityId}`);
        return existing;
      }

      // Create new relationship
      return await this.prisma.kg_relationship.create({
        data: {
          user_id: dto.userId,
          from_entity_id: dto.fromEntityId,
          to_entity_id: dto.toEntityId,
          relation_type: dto.relationType,
          properties: dto.properties || {},
          vctt_score: new Decimal(dto.vcttScore),
          confidence: new Decimal(dto.confidence),
          source_memory_id: dto.sourceMemoryId,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create relationship: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get entity by ID with relationships
   */
  async getEntityWithRelationships(entityId: string, userId: string): Promise<any> {
    return await this.prisma.kg_entity.findFirst({
      where: {
        id: entityId,
        user_id: userId,
      },
      include: {
        relationships_from: {
          include: {
            to_entity: true,
          },
        },
        relationships_to: {
          include: {
            from_entity: true,
          },
        },
        concept_mappings: {
          include: {
            concept: true,
          },
        },
      },
    });
  }

  /**
   * Query knowledge graph
   */
  async queryKnowledgeGraph(dto: KnowledgeQueryDto): Promise<any[]> {
    const where: any = {
      user_id: dto.userId,
    };

    if (dto.entityName) {
      where.name = { contains: dto.entityName, mode: 'insensitive' };
    }

    if (dto.entityType) {
      where.type = dto.entityType;
    }

    if (dto.minVCTTScore) {
      where.vctt_score = { gte: new Decimal(dto.minVCTTScore) };
    }

    const entities = await this.prisma.kg_entity.findMany({
      where,
      include: {
        relationships_from: {
          include: {
            to_entity: true,
          },
          where: dto.relationType ? { relation_type: dto.relationType } : undefined,
        },
        relationships_to: {
          include: {
            from_entity: true,
          },
        },
      },
      take: dto.limit || 50,
      orderBy: {
        vctt_score: 'desc',
      },
    });

    return entities;
  }

  /**
   * Get subgraph around an entity (BFS traversal)
   */
  async getSubgraph(entityId: string, userId: string, maxDepth: number = 2): Promise<any> {
    const visited = new Set<string>();
    const entities: any[] = [];
    const relationships: any[] = [];

    await this.bfsTraversal(entityId, userId, maxDepth, visited, entities, relationships);

    return {
      entities,
      relationships,
      count: entities.length,
    };
  }

  /**
   * BFS traversal helper
   */
  private async bfsTraversal(
    startId: string,
    userId: string,
    maxDepth: number,
    visited: Set<string>,
    entities: any[],
    relationships: any[],
  ): Promise<void> {
    const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (visited.has(id) || depth > maxDepth) {
        continue;
      }

      visited.add(id);

      // Get entity with relationships
      const entity = await this.getEntityWithRelationships(id, userId);
      if (!entity) continue;

      entities.push(entity);

      // Add outgoing relationships
      for (const rel of entity.relationships_from) {
        relationships.push(rel);
        if (!visited.has(rel.to_entity.id)) {
          queue.push({ id: rel.to_entity.id, depth: depth + 1 });
        }
      }

      // Add incoming relationships
      for (const rel of entity.relationships_to) {
        relationships.push(rel);
        if (!visited.has(rel.from_entity.id)) {
          queue.push({ id: rel.from_entity.id, depth: depth + 1 });
        }
      }
    }
  }

  /**
   * Get all entities for a user
   */
  async getAllEntities(userId: string, limit: number = 100): Promise<any[]> {
    return await this.prisma.kg_entity.findMany({
      where: { user_id: userId },
      orderBy: { vctt_score: 'desc' },
      take: limit,
    });
  }

  /**
   * Delete entity (and cascade relationships)
   */
  async deleteEntity(entityId: string, userId: string): Promise<boolean> {
    const allowed = await this.safetySteward.canPerformOperation('WRITE', userId);
    if (!allowed) {
      return false;
    }

    try {
      await this.prisma.kg_entity.delete({
        where: {
          id: entityId,
          user_id: userId,
        },
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete entity: ${error.message}`);
      return false;
    }
  }
}
