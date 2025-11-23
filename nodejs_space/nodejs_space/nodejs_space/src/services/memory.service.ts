
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SafetyStewardAgent } from '../agents/safety-steward.agent';
import { ConsentManagerService } from './consent-manager.service';
import { EmbeddingsService } from './embeddings.service';

export interface MemoryEntry {
  id?: string;
  userId: string;
  sessionId?: string;
  memoryType: 'conversation' | 'learned_fact' | 'preference';
  content: string;
  embedding?: number[];
  metadata?: any;
  vcttScore?: number;
  expiresAt?: Date;
}

export interface MemorySearchOptions {
  userId: string;
  query?: string;
  memoryType?: string;
  limit?: number;
  minVcttScore?: number;
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly safetySteward: SafetyStewardAgent,
    private readonly consentManager: ConsentManagerService,
    private readonly embeddingsService: EmbeddingsService,
  ) {
    this.enabled = process.env.MEMORY_PERSISTENCE_ENABLED === 'true';
    this.logger.log(
      `💾 Memory Service initialized (Enabled: ${this.enabled})`,
    );
  }

  /**
   * Store a memory entry
   */
  async storeMemory(entry: MemoryEntry): Promise<MemoryEntry | null> {
    if (!this.enabled) {
      this.logger.debug('Memory persistence disabled, skipping storage');
      return null;
    }

    // Check consent
    const hasConsent = await this.consentManager.hasConsent(
      entry.userId,
      entry.memoryType,
    );
    if (!hasConsent) {
      this.logger.warn(`User ${entry.userId} has not consented to memory storage`);
      return null;
    }

    // Safety check
    const safetyCheck = await this.safetySteward.checkOperation('WRITE', {
      userId: entry.userId,
      intent: 'Store memory entry',
      data: entry,
    });

    if (!safetyCheck.allowed) {
      this.logger.warn(
        `Memory storage blocked by SafetySteward: ${safetyCheck.reason}`,
      );
      await this.auditOperation(entry.userId, 'CREATE', null, 'BLOCKED', false);
      return null;
    }

    try {
      // Generate embedding for semantic search
      let embedding: number[] | null = null;
      if (entry.content && entry.content.length > 0) {
        embedding = await this.embeddingsService.generateEmbedding(
          entry.content,
        );
      }

      // Calculate expiration
      const retentionDays = parseInt(
        process.env.MEMORY_RETENTION_DAYS || '90',
        10,
      );
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + retentionDays);

      // Store in database
      const memory = await this.prisma.user_memory.create({
        data: {
          user_id: entry.userId,
          session_id: entry.sessionId || null,
          memory_type: entry.memoryType,
          content: entry.content,
          embedding: embedding as any,
          metadata: entry.metadata || {},
          vctt_score: entry.vcttScore || null,
          expires_at: entry.expiresAt || expiresAt,
        },
      });

      this.logger.log(
        `✅ Memory stored for user ${entry.userId}: ${memory.id}`,
      );

      // Audit log
      await this.auditOperation(
        entry.userId,
        'CREATE',
        memory.id,
        'Success',
        true,
      );

      return this.mapToMemoryEntry(memory);
    } catch (error) {
      this.logger.error(`Failed to store memory: ${error.message}`, error.stack);
      await this.auditOperation(entry.userId, 'CREATE', null, error.message, false);
      throw error;
    }
  }

  /**
   * Retrieve memories for a user
   */
  async getMemories(options: MemorySearchOptions): Promise<MemoryEntry[]> {
    if (!this.enabled) {
      return [];
    }

    // Check consent
    const hasConsent = await this.consentManager.hasConsent(options.userId);
    if (!hasConsent) {
      return [];
    }

    // Safety check
    const safetyCheck = await this.safetySteward.checkOperation('READ', {
      userId: options.userId,
      intent: 'Retrieve memories',
    });

    if (!safetyCheck.allowed) {
      this.logger.warn(
        `Memory retrieval blocked by SafetySteward: ${safetyCheck.reason}`,
      );
      return [];
    }

    try {
      const whereClause: any = {
        user_id: options.userId,
        expires_at: { gt: new Date() }, // Only non-expired memories
      };

      if (options.memoryType) {
        whereClause.memory_type = options.memoryType;
      }

      if (options.minVcttScore) {
        whereClause.vctt_score = { gte: options.minVcttScore };
      }

      let memories = await this.prisma.user_memory.findMany({
        where: whereClause,
        orderBy: { created_at: 'desc' },
        take: options.limit || 50,
      });

      // If query provided, do semantic search
      if (options.query && memories.length > 0) {
        memories = await this.semanticSearch(options.query, memories);
      }

      // Audit log
      await this.auditOperation(
        options.userId,
        'READ',
        null,
        `Retrieved ${memories.length} memories`,
        true,
      );

      return memories.map((m) => this.mapToMemoryEntry(m));
    } catch (error) {
      this.logger.error(
        `Failed to retrieve memories: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Delete a specific memory
   */
  async deleteMemory(userId: string, memoryId: string): Promise<boolean> {
    // Safety check
    const safetyCheck = await this.safetySteward.checkOperation('WRITE', {
      userId,
      intent: 'Delete memory',
    });

    if (!safetyCheck.allowed) {
      this.logger.warn(
        `Memory deletion blocked by SafetySteward: ${safetyCheck.reason}`,
      );
      return false;
    }

    try {
      await this.prisma.user_memory.delete({
        where: {
          id: memoryId,
          user_id: userId, // Ensure user owns the memory
        },
      });

      this.logger.log(`🗑️ Memory deleted: ${memoryId}`);
      await this.auditOperation(userId, 'DELETE', memoryId, 'Success', true);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to delete memory: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Delete all memories for a user (right to deletion)
   */
  async deleteAllMemories(userId: string): Promise<number> {
    // Safety check
    const safetyCheck = await this.safetySteward.checkOperation('WRITE', {
      userId,
      intent: 'Delete all memories (right to deletion)',
    });

    if (!safetyCheck.allowed) {
      this.logger.warn(
        `Memory deletion blocked by SafetySteward: ${safetyCheck.reason}`,
      );
      return 0;
    }

    try {
      const result = await this.prisma.user_memory.deleteMany({
        where: { user_id: userId },
      });

      this.logger.log(`🗑️ Deleted ${result.count} memories for user ${userId}`);
      await this.auditOperation(
        userId,
        'DELETE',
        null,
        `Deleted ${result.count} memories`,
        true,
      );

      // Also revoke consent
      await this.consentManager.revokeConsent(userId);

      return result.count;
    } catch (error) {
      this.logger.error(
        `Failed to delete all memories: ${error.message}`,
        error.stack,
      );
      return 0;
    }
  }

  /**
   * Export all memories for a user
   */
  async exportMemories(userId: string): Promise<MemoryEntry[]> {
    const hasConsent = await this.consentManager.hasConsent(userId);
    if (!hasConsent) {
      return [];
    }

    try {
      const memories = await this.prisma.user_memory.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'asc' },
      });

      await this.auditOperation(
        userId,
        'EXPORT',
        null,
        `Exported ${memories.length} memories`,
        true,
      );

      return memories.map((m) => this.mapToMemoryEntry(m));
    } catch (error) {
      this.logger.error(
        `Failed to export memories: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Semantic search using embeddings
   */
  private async semanticSearch(
    query: string,
    memories: any[],
  ): Promise<any[]> {
    try {
      const queryEmbedding = await this.embeddingsService.generateEmbedding(
        query,
      );
      if (!queryEmbedding) {
        return memories;
      }

      // Calculate cosine similarity and sort
      const memoriesWithScores = memories
        .map((memory) => {
          if (!memory.embedding) {
            return { memory, score: 0 };
          }

          const embedding = Array.isArray(memory.embedding)
            ? memory.embedding
            : memory.embedding;
          const score = this.cosineSimilarity(queryEmbedding, embedding);

          return { memory, score };
        })
        .filter((item) => item.score > 0.5) // Relevance threshold
        .sort((a, b) => b.score - a.score);

      return memoriesWithScores.map((item) => item.memory);
    } catch (error) {
      this.logger.error(
        `Semantic search failed: ${error.message}`,
        error.stack,
      );
      return memories;
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Audit a memory operation
   */
  private async auditOperation(
    userId: string,
    operation: string,
    memoryId: string | null,
    reason: string,
    vcttVerification: boolean,
  ): Promise<void> {
    try {
      await this.prisma.memory_audit.create({
        data: {
          user_id: userId,
          operation,
          memory_id: memoryId,
          reason,
          vctt_verification: vcttVerification,
          metadata: {
            timestamp: new Date().toISOString(),
            enabled: this.enabled,
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`);
    }
  }

  /**
   * Map database model to MemoryEntry
   */
  private mapToMemoryEntry(memory: any): MemoryEntry {
    return {
      id: memory.id,
      userId: memory.user_id,
      sessionId: memory.session_id,
      memoryType: memory.memory_type,
      content: memory.content,
      embedding: memory.embedding || undefined,
      metadata: memory.metadata,
      vcttScore: memory.vctt_score ? parseFloat(memory.vctt_score) : undefined,
      expiresAt: memory.expires_at,
    };
  }

}
