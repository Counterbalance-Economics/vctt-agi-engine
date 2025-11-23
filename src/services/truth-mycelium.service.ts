
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * 🍄 TRUTH MYCELIUM SERVICE
 * 
 * The living root system that keeps the entire VCTT-AGI network honest.
 * Grok 4.1's verified facts persist across sessions, growing a shared substrate of truth.
 */

export interface VerifiedFact {
  fact: string;
  confidence: number; // 0-1
  sources: string[];
  verifiedBy: string; // "grok-beta"
  timestamp: Date;
  topic?: string;
  sessionId?: string;
}

export interface TruthCacheEntry {
  key: string; // truth:{hash}
  value: VerifiedFact;
  expiresAt: Date; // 30 days TTL
}

@Injectable()
export class TruthMyceliumService {
  private readonly logger = new Logger(TruthMyceliumService.name);
  private readonly cache = new Map<string, TruthCacheEntry>();
  private readonly TTL_DAYS = 30;
  private readonly MIN_CONFIDENCE = 0.7; // Only cache high-confidence facts

  /**
   * Generate normalized hash for a fact (deduplication)
   */
  private normalizeFactHash(fact: string): string {
    const normalized = fact
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  }

  /**
   * Store a verified fact in the mycelium
   */
  storeFact(fact: VerifiedFact): void {
    if (fact.confidence < this.MIN_CONFIDENCE) {
      this.logger.debug(`Skipping low-confidence fact (${fact.confidence}): ${fact.fact.substring(0, 50)}...`);
      return;
    }

    const hash = this.normalizeFactHash(fact.fact);
    const key = `truth:${hash}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.TTL_DAYS);

    this.cache.set(key, {
      key,
      value: { ...fact, timestamp: new Date() },
      expiresAt,
    });

    this.logger.log(`🍄 Mycelium grew: ${fact.fact.substring(0, 80)}... (confidence: ${fact.confidence})`);
  }

  /**
   * Bulk store multiple verified facts
   */
  bulkStoreFacts(facts: VerifiedFact[]): void {
    let stored = 0;
    for (const fact of facts) {
      if (fact.confidence >= this.MIN_CONFIDENCE) {
        this.storeFact(fact);
        stored++;
      }
    }
    this.logger.log(`🍄 Mycelium bulk growth: ${stored}/${facts.length} facts stored`);
  }

  /**
   * Retrieve verified facts relevant to a topic/query
   */
  getRelevantFacts(topic: string, limit = 10): VerifiedFact[] {
    this.cleanExpired(); // Remove expired entries first

    const topicKeywords = topic
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const scoredFacts: Array<{ fact: VerifiedFact; score: number }> = [];

    for (const entry of this.cache.values()) {
      const factLower = entry.value.fact.toLowerCase();
      let score = 0;

      // Score by keyword matches
      for (const keyword of topicKeywords) {
        if (factLower.includes(keyword)) {
          score += 1;
        }
      }

      // Boost by confidence
      score *= entry.value.confidence;

      // Boost by recency (newer = better)
      const ageInDays = (Date.now() - entry.value.timestamp.getTime()) / (1000 * 60 * 60 * 24);
      score *= Math.max(0.5, 1 - ageInDays / this.TTL_DAYS);

      if (score > 0) {
        scoredFacts.push({ fact: entry.value, score });
      }
    }

    // Sort by score and return top N
    return scoredFacts
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(sf => sf.fact);
  }

  /**
   * Get all facts (for analytics/visualization)
   */
  getAllFacts(): VerifiedFact[] {
    this.cleanExpired();
    return Array.from(this.cache.values()).map(entry => entry.value);
  }

  /**
   * Get mycelium statistics
   */
  getStats(): {
    totalFacts: number;
    avgConfidence: number;
    topSources: Array<{ source: string; count: number }>;
    growthToday: number;
    oldestFact: Date | null;
    newestFact: Date | null;
  } {
    this.cleanExpired();

    const facts = this.getAllFacts();
    
    if (facts.length === 0) {
      return {
        totalFacts: 0,
        avgConfidence: 0,
        topSources: [],
        growthToday: 0,
        oldestFact: null,
        newestFact: null,
      };
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Calculate statistics
    const avgConfidence = facts.reduce((sum, f) => sum + f.confidence, 0) / facts.length;
    
    const growthToday = facts.filter(f => f.timestamp >= todayStart).length;

    const sourceCounts = new Map<string, number>();
    for (const fact of facts) {
      for (const source of fact.sources) {
        sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
      }
    }

    const topSources = Array.from(sourceCounts.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const timestamps = facts.map(f => f.timestamp.getTime());
    const oldestFact = new Date(Math.min(...timestamps));
    const newestFact = new Date(Math.max(...timestamps));

    return {
      totalFacts: facts.length,
      avgConfidence,
      topSources,
      growthToday,
      oldestFact,
      newestFact,
    };
  }

  /**
   * Format verified facts for injection into agent prompts
   */
  formatFactsForPrompt(facts: VerifiedFact[]): string {
    if (facts.length === 0) {
      return '';
    }

    const factLines = facts.map(f => {
      const source = f.sources[0] || 'verified';
      const confidence = Math.round(f.confidence * 100);
      return `• ${f.fact} (${confidence}% confidence, source: ${source})`;
    });

    return `\n\n🍄 VERIFIED FACTS FROM TRUTH MYCELIUM:\n${factLines.join('\n')}\n`;
  }

  /**
   * Extract potential fact claims from text (simple heuristic)
   */
  extractClaims(text: string): string[] {
    // Simple extraction: sentences with factual markers
    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20);

    const factualMarkers = [
      /\b(is|was|are|were|has|have|had)\b/i,
      /\b(according to|reports|data|study|research)\b/i,
      /\b\d+/,  // Contains numbers (likely factual)
      /\b(percent|%|million|billion|year|years)\b/i,
    ];

    return sentences.filter(sentence => {
      return factualMarkers.some(marker => marker.test(sentence));
    });
  }

  /**
   * Clean expired entries from cache
   */
  private cleanExpired(): void {
    const now = new Date();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`🍄 Mycelium cleanup: removed ${cleaned} expired facts`);
    }
  }

  /**
   * Check if mycelium is healthy
   */
  isHealthy(): boolean {
    return true; // In-memory cache is always healthy
  }

  /**
   * Get cache size for monitoring
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}
