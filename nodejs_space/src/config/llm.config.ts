
/**
 * LLM Configuration for VCTT-AGI Engine
 * 
 * HYBRID MULTI-MODEL ARCHITECTURE (Phase 3.5+)
 * - Analyst: Claude 3.5 Sonnet (MCP for DB queries, calculations, APIs)
 * - Relational: GPT-5.1 (emotional intelligence, no tools needed)
 * - Ethics: GPT-5.1 (moral reasoning, lightweight)
 * - Synthesiser: Claude 3.5 Sonnet (MCP for synthesis + tools) + Grok 4.1 (verification)
 * 
 * Budget: ~$250/month with MCP overhead
 */

export const LLMConfig = {
  // Abacus.AI RouteLLM endpoint
  baseUrl: 'https://apps.abacus.ai/v1/chat/completions',
  
  // xAI Grok API endpoint
  grokBaseUrl: 'https://api.x.ai/v1/chat/completions',
  
  // HYBRID MODEL CONFIGURATION (Per-Agent)
  models: {
    // Agent-specific models (leveraging strengths)
    analyst: 'gpt-4o',                          // GPT-4o for analysis (Claude having issues)
    relational: 'gpt-4o',                       // GPT-4o for emotional nuance
    ethics: 'gpt-4o',                           // GPT-4o for moral reasoning
    synthesiser: 'gpt-4o',                      // GPT-4o for synthesis
    
    // Legacy/fallback models
    primary: 'gpt-4o',                          // Default for non-agent use
    fallback: 'gpt-4o-mini',                    // Fallback to GPT-4o-mini (faster/cheaper)
    
    // 🥁 GROK VERIFIER - Truth Anchor & Drummer
    // Using: 'grok-beta' (current stable xAI API model)
    // Alternative: 'grok-2-1212' (latest version)
    verification: 'grok-beta',                  // Grok Beta (current xAI API stable)
  },
  
  // MCP Tool Configuration (ENABLED - schemas fixed per Claude requirements)
  // Tools are now defined in mcp-tools.config.ts with proper JSON Schema compliance
  mcpTools: {
    analyst: ['query_database', 'calculate'],
    synthesiser: ['web_search', 'analyze_trust', 'query_database'],
  },
  
  // Token limits and budgets
  limits: {
    maxTokensPerRequest: 4000,   // Max output tokens per request
    maxContextWindow: 128000,    // Max context window (GPT-4o supports 128k)
    dailyBudgetUSD: 10,          // $10/day budget (~$300/month)
    alertThreshold: 0.8,         // Alert at 80% of daily budget
  },
  
  // Request parameters
  temperature: 0.7,              // Balanced creativity
  topP: 0.9,                     // Nucleus sampling
  frequencyPenalty: 0.3,         // Reduce repetition
  presencePenalty: 0.2,          // Encourage topic diversity
  
  // Retry configuration
  retry: {
    maxRetries: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
  },
  
  // Cost tracking (approximate, in USD)
  costs: {
    'gpt-5': {
      inputPer1k: 0.0025,        // $2.50 per 1M input tokens
      outputPer1k: 0.010,        // $10.00 per 1M output tokens
    },
    'gpt-5.1': {
      inputPer1k: 0.0025,        // $2.50 per 1M input tokens (legacy)
      outputPer1k: 0.010,        // $10.00 per 1M output tokens
    },
    'gpt-4o': {
      inputPer1k: 0.0025,        // $2.50 per 1M input tokens
      outputPer1k: 0.010,        // $10.00 per 1M output tokens
    },
    'claude': {
      inputPer1k: 0.003,         // $3.00 per 1M input tokens (legacy)
      outputPer1k: 0.015,        // $15.00 per 1M output tokens
    },
    'claude-3-5-sonnet': {
      inputPer1k: 0.003,         // $3.00 per 1M input tokens
      outputPer1k: 0.015,        // $15.00 per 1M output tokens
    },
    'claude-3-5-sonnet-20241022': {
      inputPer1k: 0.003,         // $3.00 per 1M input tokens (legacy)
      outputPer1k: 0.015,        // $15.00 per 1M output tokens
    },
    'claude-haiku-4-5': {
      inputPer1k: 0.001,         // $1.00 per 1M input tokens (Haiku 4.5)
      outputPer1k: 0.005,        // $5.00 per 1M output tokens (estimated)
    },
    'grok-3': {
      inputPer1k: 0.005,         // $5.00 per 1M input tokens (legacy, deprecated)
      outputPer1k: 0.015,        // $15.00 per 1M output tokens
    },
    // GROK FAMILY (xAI API) - Cheapest frontier models
    // xAI pricing: $2.00 per 1M input, $10.00 per 1M output (grok-beta)
    'grok-beta': {
      inputPer1k: 0.002,         // $2.00 per 1M input tokens - CURRENT STABLE
      outputPer1k: 0.010,        // $10.00 per 1M output tokens
    },
    'grok-2-1212': {
      inputPer1k: 0.002,         // $2.00 per 1M input tokens
      outputPer1k: 0.010,        // $10.00 per 1M output tokens
    },
    // Default for auto-routed models (RouteLLM will pick optimal Claude)
    '': {
      inputPer1k: 0.003,         // $3.00 per 1M input tokens (Claude pricing)
      outputPer1k: 0.015,        // $15.00 per 1M output tokens
    },
  },
  
  // Verification settings
  verification: {
    enableWebSearch: true,       // Enable Grok's web search capabilities
    enableXSearch: true,         // Enable X (Twitter) semantic search
    minTrustForVerification: 0.8, // Only verify if trust τ < 0.8
    maxVerificationsPerHour: 20,  // Limit verification calls (cost control)
  },
};
