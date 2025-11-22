
import { Controller, Post, Get, Delete, Body, Param, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { EntityExtractionService, ExtractionResult } from '../services/entity-extraction.service';
import { KnowledgeGraphService, CreateEntityDto, CreateRelationshipDto } from '../services/knowledge-graph.service';
import { ConceptHierarchyService } from '../services/concept-hierarchy.service';

export class ExtractEntitiesDto {
  userId: string;
  text: string;
  autoStore?: boolean; // Automatically store extracted entities
  vcttScore?: number;
}

export class QueryKnowledgeDto {
  userId: string;
  entityName?: string;
  entityType?: string;
  relationType?: string;
  minVCTTScore?: number;
  limit?: number;
}

@ApiTags('Knowledge Graph')
@Controller('api/knowledge')
export class KnowledgeController {
  private readonly logger = new Logger(KnowledgeController.name);

  constructor(
    private readonly entityExtraction: EntityExtractionService,
    private readonly knowledgeGraph: KnowledgeGraphService,
    private readonly conceptHierarchy: ConceptHierarchyService,
  ) {}

  @Post('extract')
  @ApiOperation({ summary: 'Extract entities and relationships from text' })
  @ApiResponse({ status: 200, description: 'Extraction successful' })
  @ApiBody({ type: ExtractEntitiesDto })
  async extractEntities(@Body() dto: ExtractEntitiesDto): Promise<any> {
    this.logger.log(`Extracting entities for user: ${dto.userId}`);

    const result: ExtractionResult = await this.entityExtraction.extractFromText(
      dto.text,
      dto.userId,
    );

    // Auto-store entities if requested
    if (dto.autoStore && result.entities.length > 0) {
      const storedEntities = [];
      
      for (const entity of result.entities) {
        const stored = await this.knowledgeGraph.createEntity({
          userId: dto.userId,
          name: entity.name,
          type: entity.type,
          description: entity.description,
          attributes: entity.attributes,
          vcttScore: dto.vcttScore || result.vcttScore,
          confidence: entity.confidence,
        });
        
        if (stored) {
          storedEntities.push(stored);
        }
      }

      return {
        success: true,
        timestamp: new Date().toISOString(),
        extraction: result,
        stored: storedEntities.length,
        entities: storedEntities,
      };
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      extraction: result,
    };
  }

  @Post('entity')
  @ApiOperation({ summary: 'Create or update an entity' })
  @ApiResponse({ status: 201, description: 'Entity created' })
  @ApiBody({ type: CreateEntityDto })
  async createEntity(@Body() dto: CreateEntityDto): Promise<any> {
    const entity = await this.knowledgeGraph.createEntity(dto);

    return {
      success: entity !== null,
      timestamp: new Date().toISOString(),
      entity,
    };
  }

  @Get('entity/:id')
  @ApiOperation({ summary: 'Get entity with relationships' })
  @ApiResponse({ status: 200, description: 'Entity retrieved' })
  @ApiQuery({ name: 'userId', required: true })
  async getEntity(@Param('id') id: string, @Query('userId') userId: string): Promise<any> {
    const entity = await this.knowledgeGraph.getEntityWithRelationships(id, userId);

    return {
      success: entity !== null,
      timestamp: new Date().toISOString(),
      entity,
    };
  }

  @Post('relationship')
  @ApiOperation({ summary: 'Create a relationship between entities' })
  @ApiResponse({ status: 201, description: 'Relationship created' })
  @ApiBody({ type: CreateRelationshipDto })
  async createRelationship(@Body() dto: CreateRelationshipDto): Promise<any> {
    const relationship = await this.knowledgeGraph.createRelationship(dto);

    return {
      success: relationship !== null,
      timestamp: new Date().toISOString(),
      relationship,
    };
  }

  @Get('query')
  @ApiOperation({ summary: 'Query knowledge graph' })
  @ApiResponse({ status: 200, description: 'Query results' })
  async queryKnowledge(@Query() dto: QueryKnowledgeDto): Promise<any> {
    const results = await this.knowledgeGraph.queryKnowledgeGraph(dto);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      count: results.length,
      results,
    };
  }

  @Get('subgraph/:entityId')
  @ApiOperation({ summary: 'Get subgraph around an entity' })
  @ApiResponse({ status: 200, description: 'Subgraph retrieved' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'maxDepth', required: false })
  async getSubgraph(
    @Param('entityId') entityId: string,
    @Query('userId') userId: string,
    @Query('maxDepth') maxDepth?: string,
  ): Promise<any> {
    const depth = maxDepth ? parseInt(maxDepth, 10) : 2;
    const subgraph = await this.knowledgeGraph.getSubgraph(entityId, userId, depth);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      ...subgraph,
    };
  }

  @Get('concepts')
  @ApiOperation({ summary: 'Get concept hierarchy' })
  @ApiResponse({ status: 200, description: 'Concept hierarchy' })
  @ApiQuery({ name: 'rootId', required: false })
  async getConceptHierarchy(@Query('rootId') rootId?: string): Promise<any> {
    const hierarchy = await this.conceptHierarchy.getConceptHierarchy(rootId);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      concepts: hierarchy,
    };
  }

  @Get('concepts/:conceptId/entities')
  @ApiOperation({ summary: 'Get all entities tagged with a concept' })
  @ApiResponse({ status: 200, description: 'Entities retrieved' })
  async getEntitiesByConcept(@Param('conceptId') conceptId: string): Promise<any> {
    const entities = await this.conceptHierarchy.getEntitiesByConcept(conceptId);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      count: entities.length,
      entities,
    };
  }

  @Delete('entity/:id')
  @ApiOperation({ summary: 'Delete an entity' })
  @ApiResponse({ status: 200, description: 'Entity deleted' })
  @ApiQuery({ name: 'userId', required: true })
  async deleteEntity(@Param('id') id: string, @Query('userId') userId: string): Promise<any> {
    const deleted = await this.knowledgeGraph.deleteEntity(id, userId);

    return {
      success: deleted,
      timestamp: new Date().toISOString(),
      message: deleted ? 'Entity deleted' : 'Deletion failed or blocked',
    };
  }

  // NEW ENDPOINTS for Frontend Compatibility

  @Get('graph')
  @ApiOperation({ summary: 'Get full knowledge graph visualization data' })
  @ApiResponse({ status: 200, description: 'Knowledge graph retrieved' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getKnowledgeGraph(@Query('userId') userId?: string, @Query('limit') limit?: string): Promise<any> {
    try {
      const maxNodes = limit ? parseInt(limit, 10) : 100;
      
      // Query all entities and relationships for the user
      const queryResult = await this.knowledgeGraph.queryKnowledgeGraph({
        userId: userId || 'system',
        limit: maxNodes
      });

      // Transform to graph format (nodes and edges)
      const nodes = queryResult.map((item: any) => ({
        id: item.id || item.entityId,
        label: item.name || item.entityName,
        type: item.type || 'entity',
        properties: item.attributes || {}
      }));

      const edges: any[] = [];
      
      // Extract relationships from query results
      queryResult.forEach((item: any) => {
        if (item.relationships) {
          item.relationships.forEach((rel: any) => {
            edges.push({
              id: rel.id || `${item.id}-${rel.targetId}`,
              source: item.id,
              target: rel.targetId || rel.target,
              label: rel.type || rel.relationType,
              weight: rel.weight || 1.0
            });
          });
        }
      });

      return {
        success: true,
        timestamp: new Date().toISOString(),
        graph: {
          nodes,
          edges,
          metadata: {
            totalNodes: nodes.length,
            totalEdges: edges.length,
            userId: userId || 'system'
          }
        }
      };
    } catch (error) {
      this.logger.error('Error getting knowledge graph:', error);
      return {
        success: true,
        timestamp: new Date().toISOString(),
        graph: {
          nodes: [],
          edges: [],
          metadata: {
            totalNodes: 0,
            totalEdges: 0,
            error: error.message
          }
        }
      };
    }
  }

  @Get('search')
  @ApiOperation({ summary: 'Search knowledge graph by query' })
  @ApiResponse({ status: 200, description: 'Search results' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by entity type' })
  @ApiQuery({ name: 'limit', required: false })
  async searchKnowledge(
    @Query('q') query: string,
    @Query('userId') userId?: string,
    @Query('type') entityType?: string,
    @Query('limit') limit?: string
  ): Promise<any> {
    try {
      const maxResults = limit ? parseInt(limit, 10) : 20;

      if (!query || query.trim() === '') {
        return {
          success: true,
          timestamp: new Date().toISOString(),
          query: query,
          results: [],
          count: 0
        };
      }

      // Search knowledge graph by name/description
      const searchResults = await this.knowledgeGraph.queryKnowledgeGraph({
        userId: userId || 'system',
        entityName: query,
        entityType: entityType,
        limit: maxResults
      });

      // Also do a fuzzy text search in entity names
      const fuzzyResults = searchResults.filter((item: any) => {
        const name = (item.name || item.entityName || '').toLowerCase();
        const description = (item.description || '').toLowerCase();
        const searchTerm = query.toLowerCase();
        
        return name.includes(searchTerm) || description.includes(searchTerm);
      });

      return {
        success: true,
        timestamp: new Date().toISOString(),
        query: query,
        results: fuzzyResults,
        count: fuzzyResults.length,
        filters: {
          userId: userId || 'system',
          type: entityType,
          limit: maxResults
        }
      };
    } catch (error) {
      this.logger.error('Error searching knowledge graph:', error);
      return {
        success: true,
        timestamp: new Date().toISOString(),
        query: query,
        results: [],
        count: 0,
        error: error.message
      };
    }
  }
}
