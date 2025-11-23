
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly model: string;
  private readonly dimensions: number;
  private readonly enabled: boolean;

  constructor() {
    this.model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    this.dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || '1536', 10);
    this.enabled = process.env.MEMORY_PERSISTENCE_ENABLED === 'true';
    this.logger.log(
      `🎯 Embeddings Service initialized (Model: ${this.model}, Dimensions: ${this.dimensions})`,
    );
  }

  /**
   * Generate embedding for text
   * Uses OpenAI-compatible API or local model
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.enabled) {
      return null;
    }

    if (!text || text.trim().length === 0) {
      return null;
    }

    try {
      // Check if we have API key
      const apiKey = process.env.ABACUSAI_API_KEY || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        this.logger.warn('No API key found for embeddings, using mock embeddings');
        return this.generateMockEmbedding(text);
      }

      // Use OpenAI-compatible API
      const response = await fetch(
        process.env.OPENAI_API_BASE || 'https://api.openai.com/v1/embeddings',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            input: text.substring(0, 8000), // Limit to 8k chars
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.statusText}`);
      }

      const data = await response.json();
      const embedding = data.data?.[0]?.embedding;

      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response');
      }

      this.logger.debug(
        `✅ Generated embedding (${embedding.length} dimensions)`,
      );

      return embedding;
    } catch (error) {
      this.logger.error(
        `Failed to generate embedding: ${error.message}`,
        error.stack,
      );
      // Fallback to mock embedding
      return this.generateMockEmbedding(text);
    }
  }

  /**
   * Generate mock embedding for testing
   * Uses simple hash-based approach
   */
  private generateMockEmbedding(text: string): number[] {
    // Simple hash-based mock embedding
    const hash = this.simpleHash(text);
    const embedding: number[] = [];

    for (let i = 0; i < this.dimensions; i++) {
      const seed = hash + i;
      embedding.push(Math.sin(seed) * 0.1 + Math.cos(seed * 2) * 0.05);
    }

    return embedding;
  }

  /**
   * Simple string hash function
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  /**
   * Batch generate embeddings
   */
  async generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    const embeddings: (number[] | null)[] = [];

    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }

    return embeddings;
  }
}
