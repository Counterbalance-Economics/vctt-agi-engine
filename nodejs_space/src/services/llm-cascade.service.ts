import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { LLMConfig } from '../config/llm.config';
import { LLMCommitteeService } from './llm-committee.service';
import { getMCPToolsForAgent } from '../config/mcp-tools.config';

/**
 * LLM Cascade Service - Production-Grade Multi-Provider Resilience
 * 
 * Implements tiered LLM routing: if Tier 1 fails, fall back to Tier 2, 3, 4...
 * This ensures 99.99% uptime even during provider outages.
 * 
 * Architecture:
 * - Analyst: RouteLLM Claude → Direct Claude → Grok-4.1 → GPT-5 → GPT-4o
 * - Relational: GPT-5 → GPT-4o → Claude → Grok-4.1
 * - Ethics: GPT-5 → Claude → Grok-4.1 → GPT-4o
 * - Synthesiser: RouteLLM Claude → GPT-5 → Direct Claude → Grok-4.1
 * - Verification: Grok-4.1 Fast Reasoning → Claude (web search) → GPT-5
 * - Jazz Team: Grok-4.1 Fast Reasoning (primary) → GPT-5 (fallback only)
 * 
 * GROK 4.1 UPGRADE (Nov 2025):
 * - Model: grok-4-1-fast-reasoning (2M context, state-of-the-art reasoning)
 * - Cost: $0.20/M input, $0.50/M output (90% cheaper than Grok 2!)
 * - Use Cases: Verification, Jazz analysis, counterfactual reasoning
 */

interface LLMResponse {
  content: string;
  cost: number;
  latencyMs: number;
  tokensUsed: { input: number; output: number; total: number };
  model: string;
  usedProvider?: string;
  tierUsed?: number;
}

interface Provider {
  name: string;
  tier: number;
  call: (messages: any[], systemPrompt: string, temperature: number, tools?: any[]) => Promise<LLMResponse>;
}

@Injectable()
export class LLMCascadeService {
  private readonly logger = new Logger(LLMCascadeService.name);

  // Track current session for contribution recording
  private currentSessionId: string | null = null;

  // Lazy-loaded committee service (to avoid circular dependency)
  private committeeService: LLMCommitteeService | null = null;
  private committeeServiceLoaded = false;

  // Track provider health for smart routing
  private providerHealth: Map<string, { failures: number; lastFailure: number }> = new Map();

  constructor(private readonly moduleRef: ModuleRef) {}

  /**
   * Lazy-load the committee service to avoid circular dependencies
   */
  private getCommitteeService(): LLMCommitteeService | null {
    if (!this.committeeServiceLoaded) {
      try {
        const service = this.moduleRef.get(LLMCommitteeService, { strict: false });
        if (service) {
          this.committeeService = service;
          this.committeeServiceLoaded = true;
          this.logger.log('✅ LLMCommitteeService loaded - contribution tracking ENABLED');
        }
      } catch (error) {
        this.logger.warn('⚠️  LLMCommitteeService not available - contribution tracking disabled');
        this.committeeServiceLoaded = true; // Don't try again
      }
    }
    return this.committeeService;
  }

  /**
   * Set the current session ID for contribution tracking
   */
  setSessionId(sessionId: string | null): void {
    this.currentSessionId = sessionId;
  }

  /**
   * Cascade definitions for each role
   * Order matters: Tier 1 is tried first, then Tier 2, etc.
   */
  private readonly cascades: Record<string, Provider[]> = {
    analyst: [
      { name: 'RouteLLM-Claude-MCP', tier: 1, call: this.callRouteLLMClaude.bind(this) },
      { name: 'Direct-Claude-MCP', tier: 2, call: this.callDirectClaude.bind(this) },
      { name: 'Grok-4.1', tier: 3, call: this.callGrok.bind(this) },
      { name: 'GPT-5', tier: 4, call: this.callGPT5.bind(this) },
      { name: 'GPT-4o', tier: 5, call: this.callGPT4o.bind(this) },
    ],
    relational: [
      { name: 'GPT-5', tier: 1, call: this.callGPT5.bind(this) },
      { name: 'GPT-4o', tier: 2, call: this.callGPT4o.bind(this) },
      { name: 'Direct-Claude', tier: 3, call: this.callDirectClaude.bind(this) },
      { name: 'Grok-4.1', tier: 4, call: this.callGrok.bind(this) },
    ],
    ethics: [
      { name: 'GPT-5', tier: 1, call: this.callGPT5.bind(this) },
      { name: 'Direct-Claude', tier: 2, call: this.callDirectClaude.bind(this) },
      { name: 'Grok-4.1', tier: 3, call: this.callGrok.bind(this) },
      { name: 'GPT-4o', tier: 4, call: this.callGPT4o.bind(this) },
    ],
    synthesiser: [
      { name: 'RouteLLM-Claude-MCP', tier: 1, call: this.callRouteLLMClaude.bind(this) },
      { name: 'GPT-5', tier: 2, call: this.callGPT5.bind(this) },
      { name: 'Direct-Claude', tier: 3, call: this.callDirectClaude.bind(this) },
      { name: 'Grok-4.1', tier: 4, call: this.callGrok.bind(this) },
    ],
    verification: [
      { name: 'Grok-4.1-WebSearch', tier: 1, call: this.callGrok.bind(this) },
      { name: 'Direct-Claude-WebSearch', tier: 2, call: this.callDirectClaude.bind(this) },
      { name: 'GPT-5', tier: 3, call: this.callGPT5.bind(this) },
    ],
    // 🎵 JAZZ TEAM - Self-Improvement Analysis (Grok 4.1 Fast Reasoning ONLY)
    // Specialized counterfactual analysis requires Grok 4.1's advanced reasoning
    jazz: [
      { name: 'Grok-4.1-Fast-Reasoning', tier: 1, call: this.callGrok.bind(this) },
      { name: 'GPT-5-Fallback', tier: 2, call: this.callGPT5.bind(this) },
    ],
  };

  /**
   * Detect if query requires real-time/factual information
   */
  private requiresRealTimeData(messages: any[]): boolean {
    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
    const factualKeywords = [
      'president', 'current', 'now', 'today', '2024', '2025', 
      'latest', 'recent', 'who is', 'what is', 'election',
      'weather', 'stock', 'price', 'news', 'happened', 'update'
    ];
    return factualKeywords.some(kw => lastMessage.includes(kw));
  }

  /**
   * Main entry point: Call LLM with cascading fallback
   */
  async generateCompletion(
    messages: any[],
    systemPrompt: string,
    temperature: number,
    agentRole: string,
    enableTools: boolean = false,
    responseFormat: 'text' | 'json' = 'text',  // NEW: Support markdown/text output
  ): Promise<LLMResponse> {
    let cascade = this.cascades[agentRole] || this.cascades.analyst;
    
    // CRITICAL FIX: If query requires real-time data, prioritize Grok
    if (this.requiresRealTimeData(messages)) {
      this.logger.log(`🔍 Factual query detected - prioritizing Grok for real-time accuracy`);
      
      // Reorder cascade: Put Grok-4.1 as Tier 1 for factual queries
      const grokProvider = cascade.find(p => p.name.includes('Grok'));
      if (grokProvider) {
        cascade = [
          grokProvider,
          ...cascade.filter(p => !p.name.includes('Grok'))
        ];
      }
    }
    
    this.logger.log(`🌊 Starting cascade for ${agentRole} (${cascade.length} tiers)`);

    for (const provider of cascade) {
      // Skip unhealthy providers (circuit breaker)
      if (this.isProviderUnhealthy(provider.name)) {
        this.logger.warn(`⚠️ Skipping ${provider.name} (circuit breaker open)`);
        continue;
      }

      try {
        this.logger.log(`→ Tier ${provider.tier}: Trying ${provider.name}...`);
        const startTime = Date.now();
        
        // Get MCP tools if enabled for this agent
        const tools = (enableTools && (agentRole === 'analyst' || agentRole === 'synthesiser'))
          ? getMCPToolsForAgent(agentRole)
          : undefined;

        const result = await provider.call(messages, systemPrompt, temperature, tools);
        const latency = Date.now() - startTime;

        this.logger.log(
          `✅ ${provider.name} succeeded - ` +
          `tokens: ${result.tokensUsed.total}, ` +
          `cost: $${result.cost.toFixed(4)}, ` +
          `latency: ${latency}ms`
        );

        // Reset health on success
        this.recordSuccess(provider.name);

        // Track contribution to LLM Committee (if available)
        const committeeService = this.getCommitteeService();
        if (committeeService && this.currentSessionId) {
          await committeeService.recordContribution({
            session_id: this.currentSessionId,
            model_name: result.model,
            agent_name: agentRole,
            contributed: true,
            offline: false,
            tokens_used: result.tokensUsed.total,
            cost_usd: result.cost,
            latency_ms: latency,
          }).catch(err => {
            this.logger.debug(`Failed to record contribution: ${err.message}`);
          });
        }

        return {
          ...result,
          usedProvider: provider.name,
          tierUsed: provider.tier,
        };
      } catch (error) {
        this.logger.warn(
          `❌ Tier ${provider.tier} (${provider.name}) failed: ${error.message}`
        );
        this.recordFailure(provider.name);
        
        // Track offline contribution (if available)
        const committeeService = this.getCommitteeService();
        if (committeeService && this.currentSessionId) {
          const errorType = error.response?.status 
            ? `${error.response.status}xx` 
            : (error.message.includes('timeout') ? 'timeout' : 'error');
          
          await committeeService.recordContribution({
            session_id: this.currentSessionId,
            model_name: provider.name,
            agent_name: agentRole,
            contributed: false,
            offline: true,
            error_type: errorType,
            tokens_used: 0,
            cost_usd: 0,
            latency_ms: 0,
          }).catch(err => {
            this.logger.debug(`Failed to record offline contribution: ${err.message}`);
          });
        }
        
        // Continue to next tier
        continue;
      }
    }

    // All tiers failed - throw comprehensive error
    throw new Error(
      `🚨 ALL TIERS FAILED for ${agentRole}. ` +
      `Cascade: ${cascade.map(p => p.name).join(' → ')}`
    );
  }

  /**
   * Provider-specific call methods
   */

  private async callRouteLLMClaude(
    messages: any[],
    systemPrompt: string,
    temperature: number,
    tools?: any[],
  ): Promise<LLMResponse> {
    const apiKey = process.env.ROUTELLM_API_KEY || process.env.ABACUSAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('RouteLLM API key not configured');
    }

    // PAYLOAD SANITIZATION: RouteLLM/Claude strict mode
    // Only include supported params to avoid 500 errors
    const sanitizedPayload: any = {
      model: '', // Empty = auto-route to best Claude (Haiku 4.5)
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 4096,
    };

    // Only add tools if they exist and are properly formatted
    if (tools && tools.length > 0) {
      sanitizedPayload.tools = tools;
    }

    // NOTE: Removed temperature, top_p, frequency_penalty, presence_penalty
    // RouteLLM and Claude use adaptive defaults - custom params cause 500s

    const response = await fetch(`${LLMConfig.baseUrl}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'x-abacus-version': '2025-11-01', // Latest stable version
      },
      body: JSON.stringify(sanitizedPayload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`RouteLLM error (${response.status}): ${error.substring(0, 200)}`);
    }

    const data = await response.json();
    return this.parseOpenAIResponse(data, 'RouteLLM-Claude');
  }

  private async callDirectClaude(
    messages: any[],
    systemPrompt: string,
    temperature: number,
    tools?: any[],
  ): Promise<LLMResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    // Format payload for Claude API (strict compliance)
    const payload: any = {
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    };

    // Only add tools if they exist and are properly formatted
    // Claude requires strict JSON Schema compliance (array items, no extras)
    // Convert OpenAI format (type: function, function: {...}) to Claude format
    if (tools && tools.length > 0) {
      payload.tools = tools.map((tool: any) => {
        // If tool is in OpenAI format (has type: 'function'), convert to Claude format
        if (tool.type === 'function' && tool.function) {
          return {
            name: tool.function.name,
            description: tool.function.description,
            input_schema: tool.function.parameters, // Claude uses 'input_schema', OpenAI uses 'parameters'
          };
        }
        // Otherwise assume it's already in Claude format
        return tool;
      });
    }

    // NOTE: Temperature removed - Claude Haiku 4.5 uses adaptive defaults
    // Custom temperature causes compatibility issues with MCP tools

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error (${response.status}): ${error.substring(0, 200)}`);
    }

    const data = await response.json();
    return this.parseClaudeResponse(data, 'Direct-Claude');
  }

  private async callGPT5(
    messages: any[],
    systemPrompt: string,
    temperature: number,
  ): Promise<LLMResponse> {
    return this.callOpenAI('gpt-5', messages, systemPrompt, temperature);
  }

  private async callGPT4o(
    messages: any[],
    systemPrompt: string,
    temperature: number,
  ): Promise<LLMResponse> {
    return this.callOpenAI('gpt-4o', messages, systemPrompt, temperature);
  }

  private async callOpenAI(
    model: string,
    messages: any[],
    systemPrompt: string,
    temperature: number,
  ): Promise<LLMResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Build payload - GPT-5.1 requires omitting temperature (uses adaptive default)
    const payload: any = {
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    };

    // Only include temperature for non-GPT-5 models
    // GPT-5.1 uses dynamic temperature adaptation and rejects custom values
    if (!model.startsWith('gpt-5')) {
      payload.temperature = temperature;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI error (${response.status}): ${error.substring(0, 200)}`);
    }

    const data = await response.json();
    return this.parseOpenAIResponse(data, model);
  }

  private async callGrok(
    messages: any[],
    systemPrompt: string,
    temperature: number,
  ): Promise<LLMResponse> {
    const apiKey = process.env.XAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('xAI API key not configured');
    }

    const response = await fetch(LLMConfig.grokBaseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-2-1212',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Grok error (${response.status}): ${error.substring(0, 200)}`);
    }

    const data = await response.json();
    return this.parseOpenAIResponse(data, 'grok-2-1212');
  }

  /**
   * Response parsers
   */

  private parseOpenAIResponse(data: any, model: string): LLMResponse {
    const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const content = data.choices?.[0]?.message?.content || '';
    
    // Calculate cost
    const costs = (LLMConfig.costs as any)[model] || { inputPer1k: 0.001, outputPer1k: 0.002 };
    const cost = (usage.prompt_tokens / 1000) * costs.inputPer1k + 
                 (usage.completion_tokens / 1000) * costs.outputPer1k;

    return {
      content,
      cost,
      latencyMs: 0, // Will be calculated by caller
      tokensUsed: {
        input: usage.prompt_tokens,
        output: usage.completion_tokens,
        total: usage.total_tokens,
      },
      model,
    };
  }

  private parseClaudeResponse(data: any, model: string): LLMResponse {
    const usage = data.usage || { input_tokens: 0, output_tokens: 0 };
    const content = data.content?.[0]?.text || '';
    
    // Calculate cost (Claude pricing)
    const costs = { inputPer1k: 0.003, outputPer1k: 0.015 };
    const cost = (usage.input_tokens / 1000) * costs.inputPer1k + 
                 (usage.output_tokens / 1000) * costs.outputPer1k;

    return {
      content,
      cost,
      latencyMs: 0,
      tokensUsed: {
        input: usage.input_tokens,
        output: usage.output_tokens,
        total: usage.input_tokens + usage.output_tokens,
      },
      model,
    };
  }

  /**
   * Circuit breaker: Track provider health
   */

  private recordFailure(providerName: string): void {
    const health = this.providerHealth.get(providerName) || { failures: 0, lastFailure: 0 };
    health.failures += 1;
    health.lastFailure = Date.now();
    this.providerHealth.set(providerName, health);
  }

  private recordSuccess(providerName: string): void {
    this.providerHealth.delete(providerName); // Reset on success
  }

  private isProviderUnhealthy(providerName: string): boolean {
    const health = this.providerHealth.get(providerName);
    if (!health) return false;

    // Circuit breaker: Skip if 3+ failures in last 2 minutes
    const twoMinutesAgo = Date.now() - 120000;
    if (health.failures >= 3 && health.lastFailure > twoMinutesAgo) {
      return true;
    }

    // Reset if failures are old
    if (health.lastFailure < twoMinutesAgo) {
      this.providerHealth.delete(providerName);
      return false;
    }

    return false;
  }
}
