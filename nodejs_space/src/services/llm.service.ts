
import { Injectable, Logger } from '@nestjs/common';
import { LLMConfig } from '../config/llm.config';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  content: string;
  model: string;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
  latencyMs: number;
}

interface UsageStats {
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  modelBreakdown: Record<string, { calls: number; tokens: number; cost: number }>;
}

/**
 * LLM Service - Handles all LLM API interactions
 * 
 * Features:
 * - GPT-4o primary with Claude 3.5 Sonnet fallback
 * - Automatic retry with exponential backoff
 * - Token counting and cost tracking
 * - Budget monitoring and alerts
 */
@Injectable()
export class LLMService {
  private readonly logger = new Logger(LLMService.name);
  private usageStats: UsageStats = {
    totalCalls: 0,
    totalTokens: 0,
    totalCost: 0,
    modelBreakdown: {},
  };
  private dailyCost = 0;
  private lastResetDate = new Date().toDateString();

  constructor() {
    this.logger.log('LLM Service initialized with RouteLLM');
    this.logger.log(`Primary model: ${LLMConfig.models.primary}`);
    this.logger.log(`Fallback model: ${LLMConfig.models.fallback}`);
  }

  /**
   * Generate a completion using the LLM
   * 
   * @param messages - Conversation messages
   * @param systemPrompt - Optional system prompt
   * @param temperature - Optional temperature override
   * @returns LLM response with metadata
   */
  async generateCompletion(
    messages: Message[],
    systemPrompt?: string,
    temperature?: number,
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    
    // Reset daily cost if new day
    this.resetDailyCostIfNeeded();
    
    // Check daily budget
    if (this.dailyCost >= LLMConfig.limits.dailyBudgetUSD) {
      throw new Error(
        `Daily LLM budget exceeded: $${this.dailyCost.toFixed(2)}/$${LLMConfig.limits.dailyBudgetUSD}`
      );
    }
    
    // Prepare messages
    const fullMessages: Message[] = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;
    
    // Try primary model first, then fallback
    let response: LLMResponse;
    try {
      response = await this.callLLM(
        fullMessages,
        LLMConfig.models.primary,
        temperature,
      );
    } catch (primaryError) {
      this.logger.warn(
        `Primary model (${LLMConfig.models.primary}) failed: ${primaryError.message}`
      );
      this.logger.log(`Falling back to ${LLMConfig.models.fallback}`);
      
      try {
        response = await this.callLLM(
          fullMessages,
          LLMConfig.models.fallback,
          temperature,
        );
      } catch (fallbackError) {
        this.logger.error(
          `Both models failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`
        );
        throw new Error('LLM service unavailable: All models failed');
      }
    }
    
    response.latencyMs = Date.now() - startTime;
    
    // Track usage
    this.trackUsage(response);
    
    // Check if approaching daily budget
    if (this.dailyCost >= LLMConfig.limits.dailyBudgetUSD * LLMConfig.limits.alertThreshold) {
      this.logger.warn(
        `⚠️ Approaching daily budget: $${this.dailyCost.toFixed(2)}/$${LLMConfig.limits.dailyBudgetUSD}`
      );
    }
    
    return response;
  }

  /**
   * Call the LLM API with retry logic
   */
  private async callLLM(
    messages: Message[],
    model: string,
    temperature?: number,
  ): Promise<LLMResponse> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < LLMConfig.retry.maxRetries; attempt++) {
      try {
        const response = await fetch(LLMConfig.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: temperature ?? LLMConfig.temperature,
            max_tokens: LLMConfig.limits.maxTokensPerRequest,
            top_p: LLMConfig.topP,
            frequency_penalty: LLMConfig.frequencyPenalty,
            presence_penalty: LLMConfig.presencePenalty,
            stream: false,
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`LLM API error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        
        // Parse response
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('Invalid LLM response: missing content');
        }
        
        const inputTokens = data.usage?.prompt_tokens ?? 0;
        const outputTokens = data.usage?.completion_tokens ?? 0;
        const totalTokens = data.usage?.total_tokens ?? inputTokens + outputTokens;
        
        // Calculate cost
        const modelCosts = (LLMConfig.costs as any)[model] || LLMConfig.costs['gpt-4o'];
        const cost = 
          (inputTokens / 1000) * modelCosts.inputPer1k +
          (outputTokens / 1000) * modelCosts.outputPer1k;
        
        this.logger.log(
          `LLM call successful: model=${model}, tokens=${totalTokens}, cost=$${cost.toFixed(4)}`
        );
        
        return {
          content,
          model,
          tokensUsed: {
            input: inputTokens,
            output: outputTokens,
            total: totalTokens,
          },
          cost,
          latencyMs: 0, // Will be set by caller
        };
        
      } catch (error) {
        lastError = error;
        
        if (attempt < LLMConfig.retry.maxRetries - 1) {
          const delayMs = 
            LLMConfig.retry.initialDelayMs * 
            Math.pow(LLMConfig.retry.backoffMultiplier, attempt);
          
          this.logger.warn(
            `LLM call failed (attempt ${attempt + 1}/${LLMConfig.retry.maxRetries}): ${error.message}. Retrying in ${delayMs}ms...`
          );
          
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    
    throw lastError || new Error('LLM call failed with unknown error');
  }

  /**
   * Track LLM usage for cost monitoring
   */
  private trackUsage(response: LLMResponse): void {
    this.usageStats.totalCalls++;
    this.usageStats.totalTokens += response.tokensUsed.total;
    this.usageStats.totalCost += response.cost;
    this.dailyCost += response.cost;
    
    if (!this.usageStats.modelBreakdown[response.model]) {
      this.usageStats.modelBreakdown[response.model] = {
        calls: 0,
        tokens: 0,
        cost: 0,
      };
    }
    
    const modelStats = this.usageStats.modelBreakdown[response.model];
    modelStats.calls++;
    modelStats.tokens += response.tokensUsed.total;
    modelStats.cost += response.cost;
  }

  /**
   * Reset daily cost tracking if it's a new day
   */
  private resetDailyCostIfNeeded(): void {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.logger.log(
        `Daily reset: Yesterday's cost was $${this.dailyCost.toFixed(2)}`
      );
      this.dailyCost = 0;
      this.lastResetDate = today;
    }
  }

  /**
   * Get current usage statistics
   */
  getUsageStats(): UsageStats {
    return {
      ...this.usageStats,
      modelBreakdown: { ...this.usageStats.modelBreakdown },
    };
  }

  /**
   * Get daily cost
   */
  getDailyCost(): number {
    return this.dailyCost;
  }

  /**
   * Get remaining daily budget
   */
  getRemainingDailyBudget(): number {
    return Math.max(0, LLMConfig.limits.dailyBudgetUSD - this.dailyCost);
  }
}
