
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

interface VerificationOptions {
  enableWebSearch?: boolean;
  enableXSearch?: boolean;
  context?: string; // Additional context for verification
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
  private verificationsThisHour = 0;
  private lastVerificationReset = Date.now();

  constructor() {
    this.logger.log('LLM Service initialized with Hybrid Multi-Model Architecture');
    this.logger.log(`Analyst: ${LLMConfig.models.analyst || 'RouteLLM auto-pick (Claude)'} (MCP enabled)`);
    this.logger.log(`Relational: ${LLMConfig.models.relational}`);
    this.logger.log(`Ethics: ${LLMConfig.models.ethics}`);
    this.logger.log(`Synthesiser: ${LLMConfig.models.synthesiser || 'RouteLLM auto-pick (Claude)'} (MCP enabled)`);
    this.logger.log(`Verification: ${LLMConfig.models.verification}`);
  }

  /**
   * Generate a completion using the LLM (with agent-specific model selection)
   * 
   * @param messages - Conversation messages
   * @param systemPrompt - Optional system prompt
   * @param temperature - Optional temperature override
   * @param agentRole - Optional agent role for model selection ('analyst', 'relational', 'ethics', 'synthesiser')
   * @param enableTools - Enable MCP tools for Claude agents (default: true)
   * @returns LLM response with metadata
   */
  async generateCompletion(
    messages: Message[],
    systemPrompt?: string,
    temperature?: number,
    agentRole?: 'analyst' | 'relational' | 'ethics' | 'synthesiser',
    enableTools = true,
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
    
    // Select model based on agent role (hybrid architecture)
    const selectedModel = agentRole 
      ? (LLMConfig.models as any)[agentRole] 
      : LLMConfig.models.primary;
    
    // Get MCP tools if this is a Claude agent with tools enabled
    // Only analyst and synthesiser have MCP tools configured
    const tools = (enableTools && agentRole && (agentRole === 'analyst' || agentRole === 'synthesiser'))
      ? (LLMConfig.mcpTools as any)[agentRole]
      : undefined;
    
    if (tools && agentRole) {
      const modelName = selectedModel || 'RouteLLM auto-pick (Claude)';
      this.logger.log(`🛠️ ${agentRole} using ${modelName} with ${tools.length} MCP tools`);
    }
    
    // Try selected model first, then fallback
    let response: LLMResponse;
    try {
      response = await this.callLLM(
        fullMessages,
        selectedModel,
        temperature,
        tools,
      );
    } catch (primaryError) {
      this.logger.warn(
        `Primary model (${selectedModel}) failed: ${primaryError.message}`
      );
      this.logger.log(`Falling back to ${LLMConfig.models.fallback}`);
      
      try {
        response = await this.callLLM(
          fullMessages,
          LLMConfig.models.fallback,
          temperature,
          undefined, // Don't use tools on fallback
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
   * Generate a verification using Grok (xAI)
   * 
   * This method uses Grok's real-time web search and fact-checking capabilities
   * to verify information, especially useful for low-trust scenarios.
   * 
   * @param query - The query or statement to verify
   * @param options - Verification options (web search, X search, context)
   * @returns Verification response from Grok
   */
  async verifyWithGrok(
    query: string,
    options: VerificationOptions = {},
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    
    // Reset hourly verification count if needed
    this.resetVerificationCountIfNeeded();
    
    // Check hourly verification limit
    if (this.verificationsThisHour >= LLMConfig.verification.maxVerificationsPerHour) {
      throw new Error(
        `Hourly verification limit exceeded: ${this.verificationsThisHour}/${LLMConfig.verification.maxVerificationsPerHour}`
      );
    }
    
    // Check daily budget
    if (this.dailyCost >= LLMConfig.limits.dailyBudgetUSD) {
      throw new Error(
        `Daily LLM budget exceeded: $${this.dailyCost.toFixed(2)}/$${LLMConfig.limits.dailyBudgetUSD}`
      );
    }
    
    // Prepare verification prompt
    const systemPrompt = `You are Grok, a truth-seeking AI assistant with real-time web access. 
Your role is to verify information, fact-check claims, and provide accurate, up-to-date data.
${options.enableWebSearch ? 'Use web search to find current information.' : ''}
${options.enableXSearch ? 'Use X (Twitter) search for recent discussions and sentiment.' : ''}
${options.context ? `\nContext: ${options.context}` : ''}

Be concise, accurate, and cite your sources when possible.`;
    
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ];
    
    this.logger.log(`🔍 Grok verification request: "${query.substring(0, 100)}..."`);
    
    // Call Grok API
    const response = await this.callGrokAPI(messages);
    response.latencyMs = Date.now() - startTime;
    
    // Track usage
    this.trackUsage(response);
    this.verificationsThisHour++;
    
    this.logger.log(
      `✅ Grok verification complete: cost=$${response.cost.toFixed(4)}, latency=${response.latencyMs}ms`
    );
    
    return response;
  }

  /**
   * Call the Grok API specifically
   */
  private async callGrokAPI(messages: Message[]): Promise<LLMResponse> {
    try {
      const response = await fetch(LLMConfig.grokBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: LLMConfig.models.verification,
          messages,
          temperature: 0.3, // Lower temperature for factual verification
          max_tokens: 2000,
          stream: false,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok API error (${response.status}): ${errorText}`);
      }
      
      const data = await response.json();
      
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Invalid Grok response: missing content');
      }
      
      const inputTokens = data.usage?.prompt_tokens ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;
      const totalTokens = data.usage?.total_tokens ?? inputTokens + outputTokens;
      
      // Calculate cost (using grok-3 pricing)
      const modelCosts = LLMConfig.costs['grok-3'];
      const cost = 
        (inputTokens / 1000) * modelCosts.inputPer1k +
        (outputTokens / 1000) * modelCosts.outputPer1k;
      
      return {
        content,
        model: LLMConfig.models.verification,
        tokensUsed: {
          input: inputTokens,
          output: outputTokens,
          total: totalTokens,
        },
        cost,
        latencyMs: 0,
      };
      
    } catch (error) {
      this.logger.error(`Grok API call failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reset hourly verification count if an hour has passed
   */
  private resetVerificationCountIfNeeded(): void {
    const now = Date.now();
    const hourInMs = 60 * 60 * 1000;
    
    if (now - this.lastVerificationReset >= hourInMs) {
      this.logger.log(
        `Hourly verification reset: Used ${this.verificationsThisHour} verifications last hour`
      );
      this.verificationsThisHour = 0;
      this.lastVerificationReset = now;
    }
  }

  /**
   * Call the LLM API with retry logic
   */
  private async callLLM(
    messages: Message[],
    model: string,
    temperature?: number,
    tools?: any[], // MCP tools for Claude
  ): Promise<LLMResponse> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < LLMConfig.retry.maxRetries; attempt++) {
      try {
        // Build request body with optional MCP tools
        // Note: top_p removed as some models (GPT-5) don't support it via RouteLLM
        const requestBody: any = {
          model,
          messages,
          temperature: temperature ?? LLMConfig.temperature,
          max_tokens: LLMConfig.limits.maxTokensPerRequest,
          // Removed: top_p - not supported by all models in RouteLLM
          frequency_penalty: LLMConfig.frequencyPenalty,
          presence_penalty: LLMConfig.presencePenalty,
          stream: false,
        };
        
        // Add tools if provided (for Claude MCP)
        if (tools && tools.length > 0) {
          requestBody.tools = tools;
          requestBody.tool_choice = 'auto'; // Let model decide when to use tools
        }
        
        const response = await fetch(LLMConfig.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
          },
          body: JSON.stringify(requestBody),
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
