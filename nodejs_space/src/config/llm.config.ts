
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
    analyst: 'claude',                          // Claude MCP for data analysis + tools (RouteLLM naming)
    relational: 'gpt-5',                        // GPT-5 for emotional nuance
    ethics: 'gpt-5',                            // GPT-5 for moral reasoning
    synthesiser: 'claude',                      // Claude MCP for synthesis + tools (RouteLLM naming)
    
    // Legacy/fallback models
    primary: 'gpt-5',                           // Default for non-agent use
    fallback: 'claude',                         // Fallback chain
    verification: 'grok-3',                     // Grok-3 for real-time verification (free tier)
  },
  
  // MCP Tool Configuration (for Claude agents)
  mcpTools: {
    analyst: [
      {
        type: 'function',
        function: {
          name: 'query_database',
          description: 'Query PostgreSQL database for trust metrics, session history, and patterns',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'SQL query to execute' },
              params: { type: 'array', description: 'Query parameters' },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'calculate',
          description: 'Execute mathematical calculations or code for analysis',
          parameters: {
            type: 'object',
            properties: {
              expression: { type: 'string', description: 'Math expression or code to execute' },
              language: { type: 'string', enum: ['python', 'javascript'], description: 'Execution language' },
            },
            required: ['expression'],
          },
        },
      },
    ],
    synthesiser: [
      {
        type: 'function',
        function: {
          name: 'web_search',
          description: 'Search the web for current information (complement to Grok verification)',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              num_results: { type: 'number', description: 'Number of results (1-10)', default: 5 },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'format_output',
          description: 'Format output with markdown, code blocks, or structured data',
          parameters: {
            type: 'object',
            properties: {
              content: { type: 'string', description: 'Content to format' },
              format: { type: 'string', enum: ['markdown', 'json', 'code'], description: 'Output format' },
            },
            required: ['content', 'format'],
          },
        },
      },
    ],
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
      inputPer1k: 0.003,         // $3.00 per 1M input tokens
      outputPer1k: 0.015,        // $15.00 per 1M output tokens
    },
    'claude-3-5-sonnet-20241022': {
      inputPer1k: 0.003,         // $3.00 per 1M input tokens (legacy)
      outputPer1k: 0.015,        // $15.00 per 1M output tokens
    },
    'grok-3': {
      inputPer1k: 0.005,         // $5.00 per 1M input tokens (xAI pricing)
      outputPer1k: 0.015,        // $15.00 per 1M output tokens
    },
    'grok-4.1': {
      inputPer1k: 0.005,         // $5.00 per 1M input tokens (legacy)
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
