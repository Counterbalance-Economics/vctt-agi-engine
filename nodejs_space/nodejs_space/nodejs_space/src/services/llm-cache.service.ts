
import { Injectable, Logger } from '@nestjs/common';

/**
 * LLM Cache Service - Simple In-Memory Caching for Speed
 * 
 * Caches common subtasks to avoid redundant LLM calls
 * Target: 95%+ cache hit rate on repeated queries
 * 
 * Performance Impact: Instant response (<10ms) for cached queries
 */

interface CacheEntry {
  content: string;
  model: string;
  tokensUsed: { input: number; output: number; total: number };
  cost: number;
  timestamp: number;
  hitCount: number;
}

@Injectable()
export class LLMCacheService {
  private readonly logger = new Logger(LLMCacheService.name);
  private cache = new Map<string, CacheEntry>();
  private readonly maxCacheSize = 1000; // Keep last 1000 entries
  private readonly ttlMs = 24 * 60 * 60 * 1000; // 24 hours TTL
  
  private hits = 0;
  private misses = 0;

  /**
   * Generate cache key from messages and model
   */
  private getCacheKey(messages: any[], model: string, temperature?: number): string {
    const msgHash = JSON.stringify(messages.map(m => ({ role: m.role, content: m.content })));
    return `${model}:${temperature || 0.7}:${this.simpleHash(msgHash)}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if response is cached
   */
  get(messages: any[], model: string, temperature?: number): CacheEntry | null {
    const key = this.getCacheKey(messages, model, temperature);
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    // Check TTL
    const age = Date.now() - entry.timestamp;
    if (age > this.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      this.logger.log(`🗑️  Cache expired (age: ${(age / 3600000).toFixed(1)}h)`);
      return null;
    }
    
    // Cache hit!
    this.hits++;
    entry.hitCount++;
    
    const hitRate = ((this.hits / (this.hits + this.misses)) * 100).toFixed(1);
    this.logger.log(
      `✨ Cache HIT (rate: ${hitRate}%, saved $${entry.cost.toFixed(4)}, hits: ${entry.hitCount})`
    );
    
    return entry;
  }

  /**
   * Store response in cache
   */
  set(
    messages: any[], 
    model: string, 
    response: { content: string; tokensUsed: any; cost: number },
    temperature?: number,
  ): void {
    const key = this.getCacheKey(messages, model, temperature);
    
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = Array.from(this.cache.keys())[0];
      this.cache.delete(oldestKey);
      this.logger.log('🗑️  Cache full - evicted oldest entry');
    }
    
    this.cache.set(key, {
      content: response.content,
      model,
      tokensUsed: response.tokensUsed,
      cost: response.cost,
      timestamp: Date.now(),
      hitCount: 0,
    });
    
    this.logger.log(`💾 Cache MISS - stored new entry (size: ${this.cache.size})`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;
    
    // Calculate total savings
    let totalSavings = 0;
    let totalHits = 0;
    this.cache.forEach(entry => {
      totalSavings += entry.cost * entry.hitCount;
      totalHits += entry.hitCount;
    });
    
    return {
      cacheSize: this.cache.size,
      maxSize: this.maxCacheSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: hitRate.toFixed(1) + '%',
      totalSavingsUSD: totalSavings.toFixed(4),
      avgHitsPerEntry: totalHits / (this.cache.size || 1),
    };
  }

  /**
   * Clear cache (useful for testing)
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.logger.log('🗑️  Cache cleared');
  }
}
