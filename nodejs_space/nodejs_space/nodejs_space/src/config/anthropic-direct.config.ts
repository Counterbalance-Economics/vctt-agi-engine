
/**
 * Direct Anthropic API Configuration
 * 
 * Bypasses RouteLLM for faster latency (<10s vs ~45s)
 * Use this for time-critical agents (Analyst, Synthesiser)
 * 
 * Requires ANTHROPIC_API_KEY in .env
 */

type ClaudeModel = 'claude-3-5-haiku-20241022' | 'claude-3-5-sonnet-20241022';

interface ModelCost {
  inputPer1k: number;
  outputPer1k: number;
}

export const AnthropicDirectConfig = {
  // Direct Anthropic API endpoint
  baseUrl: 'https://api.anthropic.com/v1/messages',
  
  // Model selection
  defaultModel: 'claude-3-5-haiku-20241022' as ClaudeModel, // Claude Haiku 4.5 (fast + cheap)
  sonnetModel: 'claude-3-5-sonnet-20241022' as ClaudeModel, // Claude Sonnet (if needed)
  
  // Use direct API when enabled
  enabled: true, // Set to true to bypass RouteLLM
  
  // Cost tracking (Nov 2025 pricing)
  costs: {
    'claude-3-5-haiku-20241022': {
      inputPer1k: 0.001,  // $1.00 per 1M tokens
      outputPer1k: 0.005, // $5.00 per 1M tokens
    },
    'claude-3-5-sonnet-20241022': {
      inputPer1k: 0.003,  // $3.00 per 1M tokens
      outputPer1k: 0.015, // $15.00 per 1M tokens
    },
  } as Record<ClaudeModel, ModelCost>,
  
  // Performance expectations
  expectedLatency: {
    haiku: '5-10s',   // Fast
    sonnet: '10-15s', // Moderate
  },
  
  // API version
  apiVersion: '2023-06-01',
};
