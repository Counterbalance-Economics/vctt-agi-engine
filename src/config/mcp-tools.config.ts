
/**
 * MCP Tool Schemas for Claude Integration
 * 
 * CRITICAL: Claude requires strict JSON Schema Draft 2020-12 compliance
 * - All array properties MUST have "items" definitions
 * - No top-level oneOf/allOf
 * - Use "strict: true" for exact schema matching
 */

export interface MCPTool {
  type: 'function'; // Required by OpenAI/RouteLLM format
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
      additionalProperties?: boolean;
    };
    strict?: boolean;
  };
}

/**
 * Database Query Tool - For Analyst Agent
 * Queries internal state, conversation history, trust metrics
 */
export const queryDatabaseTool: MCPTool = {
  type: 'function',
  function: {
    name: 'query_database',
    description: 'Query the VCTT-AGI database for conversation history, trust metrics, or internal state. Returns structured data from PostgreSQL.',
    parameters: {
      type: 'object',
      properties: {
        query_type: {
          type: 'string',
          enum: ['conversation_history', 'trust_metrics', 'internal_state', 'session_summary'],
          description: 'Type of query to execute',
        },
      },
      required: ['query_type'],
      additionalProperties: true, // Allow optional params to avoid strict validation failures
    },
    strict: false, // Disable strict mode for RouteLLM compatibility
  },
};

/**
 * Mathematical Calculation Tool - For Analyst Agent
 * Performs precise calculations, statistical analysis
 */
export const calculateTool: MCPTool = {
  type: 'function',
  function: {
    name: 'calculate',
    description: 'Perform mathematical calculations, statistical analysis, or numerical operations with high precision.',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: 'Mathematical expression to evaluate (e.g., "12^2", "sqrt(144)", "mean([1,2,3])")',
        },
      },
      required: ['expression'],
      additionalProperties: true, // Allow optional params
    },
    strict: false, // Disable strict mode for RouteLLM compatibility
  },
};

/**
 * Web Search Tool - For Synthesiser Agent
 * Real-time information retrieval (when Grok is unavailable)
 */
export const webSearchTool: MCPTool = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the web for real-time information, current events, or factual data. Use when information is time-sensitive or external.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query string',
        },
      },
      required: ['query'],
      additionalProperties: true, // Allow optional params
    },
    strict: false, // Disable strict mode for RouteLLM compatibility
  },
};

/**
 * Trust Analysis Tool - For Synthesiser Agent
 * Analyzes trust metrics and generates recommendations
 */
export const analyzeTrustTool: MCPTool = {
  type: 'function',
  function: {
    name: 'analyze_trust',
    description: 'Analyze trust metrics (τ) for the current session, identify patterns, and recommend regulation adjustments.',
    parameters: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'Session ID to analyze',
        },
      },
      required: ['session_id'],
      additionalProperties: true, // Allow optional params
    },
    strict: false, // Disable strict mode for RouteLLM compatibility
  },
};

/**
 * MCP Tool Collections by Agent Role
 */
export const MCPToolsByAgent = {
  analyst: [
    queryDatabaseTool,
    calculateTool,
  ],
  synthesiser: [
    webSearchTool,
    analyzeTrustTool,
    queryDatabaseTool, // Synthesiser can also query DB for context
  ],
  relational: [], // Relational agent doesn't need tools (emotional intelligence only)
  ethics: [], // Ethics agent doesn't need tools (moral reasoning only)
};

/**
 * Get MCP tools for a specific agent
 */
export function getMCPToolsForAgent(agentRole: string): MCPTool[] {
  return (MCPToolsByAgent as any)[agentRole] || [];
}
