
/**
 * LLM Configuration for VCTT-AGI Engine
 * 
 * Primary: GPT-4o (via Abacus RouteLLM)
 * Fallback: Claude 3.5 Sonnet
 * Verification: Grok (xAI) - Real-time fact-checking & web access
 * Budget: <$200/month for LLM calls
 */

export const LLMConfig = {
  // Abacus.AI RouteLLM endpoint
  baseUrl: 'https://apps.abacus.ai/v1/chat/completions',
  
  // xAI Grok API endpoint
  grokBaseUrl: 'https://api.x.ai/v1/chat/completions',
  
  // Model configuration
  models: {
    primary: 'gpt-4o',           // OpenAI GPT-4o - best reasoning
    fallback: 'claude-3-5-sonnet-20241022', // Claude 3.5 Sonnet - reliable fallback
    verification: 'grok-4.1',    // xAI Grok 4.1 (Nov 2025) - 3x fewer hallucinations, real-time verification
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
    'gpt-4o': {
      inputPer1k: 0.0025,        // $2.50 per 1M input tokens
      outputPer1k: 0.010,        // $10.00 per 1M output tokens
    },
    'claude-3-5-sonnet-20241022': {
      inputPer1k: 0.003,         // $3.00 per 1M input tokens
      outputPer1k: 0.015,        // $15.00 per 1M output tokens
    },
    'grok-4.1': {
      inputPer1k: 0.005,         // $5.00 per 1M input tokens (xAI pricing)
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
