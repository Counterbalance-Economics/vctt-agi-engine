
import { Injectable, Logger } from '@nestjs/common';
import { LLMService } from './llm.service';

export interface ExtractedEntity {
  name: string;
  type: 'person' | 'place' | 'organization' | 'concept' | 'event' | 'technology' | 'skill';
  description?: string;
  confidence: number;
  attributes?: Record<string, any>;
}

export interface ExtractedRelationship {
  fromEntity: string;
  toEntity: string;
  relationType: string;
  confidence: number;
  properties?: Record<string, any>;
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
  vcttScore: number;
}

@Injectable()
export class EntityExtractionService {
  private readonly logger = new Logger(EntityExtractionService.name);

  constructor(private readonly llmService: LLMService) {}

  /**
   * Extract entities and relationships from text using LLM
   */
  async extractFromText(text: string, userId: string): Promise<ExtractionResult> {
    this.logger.log(`Extracting entities from text for user ${userId}`);

    try {
      // Build extraction prompt
      const prompt = this.buildExtractionPrompt(text);

      // Call LLM for entity extraction
      const messages = [{ role: 'user' as const, content: prompt }];
      const response = await this.llmService.generateCompletion(
        messages,
        'You are an expert entity extraction system.',
        0.3, // Low temperature for factual extraction
      );

      // Parse LLM response
      const extracted = this.parseLLMResponse(response.content);

      this.logger.log(
        `Extracted ${extracted.entities.length} entities and ${extracted.relationships.length} relationships`,
      );

      return extracted;
    } catch (error) {
      this.logger.error(`Entity extraction failed: ${error.message}`);
      // Return empty result on failure
      return {
        entities: [],
        relationships: [],
        vcttScore: 0.5,
      };
    }
  }

  /**
   * Build extraction prompt for LLM
   */
  private buildExtractionPrompt(text: string): string {
    return `You are an entity extraction system. Extract all named entities and relationships from the following text.

Text:
"""
${text}
"""

Extract the following:

1. **Entities**: Identify people, places, organizations, concepts, events, technologies, and skills.
   - For each entity, provide: name, type, description (optional), confidence (0.0-1.0)

2. **Relationships**: Identify connections between entities.
   - For each relationship, provide: fromEntity, toEntity, relationType, confidence (0.0-1.0)

Common relationship types:
- works_for, works_with, employed_by
- located_in, based_in
- part_of, member_of
- founded, created, developed
- specializes_in, expert_in
- related_to, associated_with

**Output Format (JSON only, no explanation):**
\`\`\`json
{
  "entities": [
    {
      "name": "Entity Name",
      "type": "person|place|organization|concept|event|technology|skill",
      "description": "Brief description",
      "confidence": 0.95,
      "attributes": {}
    }
  ],
  "relationships": [
    {
      "fromEntity": "Entity 1",
      "toEntity": "Entity 2",
      "relationType": "relationship_type",
      "confidence": 0.90
    }
  ],
  "vcttScore": 0.85
}
\`\`\`

**Important:**
- Only extract entities explicitly mentioned in the text
- Set confidence based on how clear the entity/relationship is
- vcttScore reflects overall extraction trustworthiness
- Return valid JSON only, no markdown, no explanations`;
  }

  /**
   * Parse LLM response and extract structured data
   */
  private parseLLMResponse(response: string): ExtractionResult {
    try {
      // Remove markdown code blocks if present
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\s*/g, '');
      }

      const parsed = JSON.parse(jsonStr);

      return {
        entities: parsed.entities || [],
        relationships: parsed.relationships || [],
        vcttScore: parsed.vcttScore || 0.75,
      };
    } catch (error) {
      this.logger.warn(`Failed to parse LLM response: ${error.message}`);
      // Return empty result on parse failure
      return {
        entities: [],
        relationships: [],
        vcttScore: 0.5,
      };
    }
  }

  /**
   * Find existing entity by name (fuzzy matching)
   */
  async findSimilarEntity(
    name: string,
    type: string,
    existingEntities: Array<{ name: string; type: string }>,
  ): Promise<{ name: string; type: string } | null> {
    const normalizedName = name.toLowerCase().trim();

    for (const entity of existingEntities) {
      const normalizedExisting = entity.name.toLowerCase().trim();

      // Exact match
      if (normalizedExisting === normalizedName && entity.type === type) {
        return entity;
      }

      // Close match (for handling variations like "John Doe" vs "John")
      if (normalizedExisting.includes(normalizedName) || normalizedName.includes(normalizedExisting)) {
        if (entity.type === type) {
          return entity;
        }
      }
    }

    return null;
  }

  /**
   * Calculate VCTT score for extracted entity
   */
  calculateVCTTScore(entity: ExtractedEntity, sourceVCTT: number): number {
    // Combine entity confidence with source VCTT
    const combined = (entity.confidence * 0.6 + sourceVCTT * 0.4);
    return Math.min(Math.max(combined, 0), 1);
  }
}
