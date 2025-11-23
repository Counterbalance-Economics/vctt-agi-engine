
import { Injectable, Logger } from '@nestjs/common';
import { LLMService } from '../services/llm.service';
import { Message } from '../entities/message.entity';

/**
 * Planner Agent - "Band Leader" for Multi-Agent Collaboration
 * 
 * Role: Decomposes user queries into parallel subtasks for each agent
 * Think of this as the conductor who assigns each musician their part
 * 
 * Output: JSON task plan with agent assignments and weights
 */

interface TaskPlan {
  tasks: AgentTask[];
  strategy: 'parallel' | 'sequential';
  reasoning: string;
}

interface AgentTask {
  agent: 'analyst' | 'relational' | 'ethics' | 'verification';
  subtask: string;
  weight: number;
  priority: number;
}

@Injectable()
export class PlannerAgent {
  private readonly logger = new Logger(PlannerAgent.name);

  constructor(private llmService: LLMService) {}

  /**
   * Decompose a query into parallel agent tasks
   * 
   * PHASE 3.5+ OPTIMIZATION:
   * - Simple queries use 3 agents (skip Ethics for factual questions)
   * - Complex queries use all 4 agents
   * - Target: <30s total (down from 75s)
   * 
   * @param query - User's input query
   * @param messages - Conversation history for context
   * @returns Task plan with agent assignments
   */
  async plan(query: string, messages: Message[]): Promise<TaskPlan> {
    const startTime = Date.now();
    
    // Detect simple queries (use 3-agent mode for speed)
    const isSimple = this.isSimpleQuery(query);
    const agentCount = isSimple ? 3 : 4;
    
    this.logger.log(`🎼 Planner Agent: ${isSimple ? 'SIMPLE' : 'COMPLEX'} query → ${agentCount} agents`);

    const systemPrompt = isSimple
      ? this.getSimplePlannerPrompt()
      : this.getComplexPlannerPrompt();

    const userPrompt = `Decompose this query into ${agentCount} parallel agent tasks:

Query: "${query}"

Remember: All ${agentCount} agents must contribute. Output JSON only.`;

    try {
      const response = await this.llmService.generateCompletion(
        [
          ...messages.slice(-3), // Include recent context
          { role: 'user', content: userPrompt },
        ],
        systemPrompt,
        0.3, // Low temperature for consistent planning
        'analyst', // Use analyst model (Claude) for planning
      );

      // Parse the JSON response
      let taskPlan: TaskPlan;
      try {
        // Try to extract JSON from response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          taskPlan = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        this.logger.warn('⚠️  Failed to parse planner response, using balanced fallback');
        // Fallback to balanced plan
        taskPlan = this.createBalancedFallback(query);
      }

      // Validate and normalize weights
      taskPlan = this.validateAndNormalize(taskPlan, query);

      const elapsed = Date.now() - startTime;
      this.logger.log(`✅ Task plan created in ${elapsed}ms - Strategy: ${taskPlan.strategy}`);
      this.logger.log(`   Analyst: ${(taskPlan.tasks[0].weight * 100).toFixed(0)}% - ${taskPlan.tasks[0].subtask.substring(0, 50)}...`);
      this.logger.log(`   Relational: ${(taskPlan.tasks[1].weight * 100).toFixed(0)}% - ${taskPlan.tasks[1].subtask.substring(0, 50)}...`);
      this.logger.log(`   Ethics: ${(taskPlan.tasks[2].weight * 100).toFixed(0)}% - ${taskPlan.tasks[2].subtask.substring(0, 50)}...`);
      this.logger.log(`   Verification: ${(taskPlan.tasks[3].weight * 100).toFixed(0)}% - ${taskPlan.tasks[3].subtask.substring(0, 50)}...`);

      return taskPlan;
    } catch (error) {
      this.logger.error(`❌ Planner Agent failed: ${error.message}`);
      // Return balanced fallback
      return this.createBalancedFallback(query);
    }
  }

  /**
   * Create a balanced fallback plan when planner fails
   */
  private createBalancedFallback(query: string): TaskPlan {
    // Check if query is factual (boosts Verification to 30%)
    const isFactual = this.isFactualQuery(query);
    
    const weights = isFactual 
      ? { analyst: 0.35, relational: 0.20, ethics: 0.15, verification: 0.30 }
      : { analyst: 0.30, relational: 0.25, ethics: 0.25, verification: 0.20 };
    
    this.logger.log(`🛡️  Using fallback task plan (Analyst=${(weights.analyst*100).toFixed(0)}%, Verifier=${(weights.verification*100).toFixed(0)}%)`);
    
    return {
      tasks: [
        {
          agent: 'analyst',
          subtask: `Analyze the factual content and logical structure of: "${query}"`,
          weight: weights.analyst,
          priority: 1,
        },
        {
          agent: 'relational',
          subtask: `Identify emotional context and empathetic considerations for: "${query}"`,
          weight: weights.relational,
          priority: 1,
        },
        {
          agent: 'ethics',
          subtask: `Evaluate ethical dimensions and value implications of: "${query}"`,
          weight: weights.ethics,
          priority: 1,
        },
        {
          agent: 'verification',
          subtask: `Verify factual accuracy and provide real-time current information about: "${query}"`,
          weight: weights.verification,
          priority: 1,
        },
      ],
      strategy: 'parallel',
      reasoning: isFactual ? 'Factual query - boosting Verification + Analyst' : 'Balanced fallback',
    };
  }

  /**
   * Detect simple queries (factual, no ethical dimension)
   * Simple queries use 3 agents (skip Ethics) for 25% faster response
   */
  private isSimpleQuery(query: string): boolean {
    const lowerInput = query.toLowerCase();
    
    // Factual queries (no ethics needed)
    const simplePatterns = [
      /^who (is|was|are|were)/,
      /^what (is|was|are|were)/,
      /^when (is|was|did|does)/,
      /^where (is|was|are)/,
      /^how many/,
      /^list/,
      /^name/,
      /current|latest|today|now|price|score|weather|population/,
    ];
    
    // Complex queries (need ethics)
    const complexKeywords = [
      'should', 'ethics', 'moral', 'right', 'wrong', 'fair', 'unfair',
      'justice', 'values', 'bias', 'equality', 'freedom', 'responsibility',
      'philosophical', 'debate', 'controversy', 'dilemma',
    ];
    
    // Check if complex
    const hasComplexity = complexKeywords.some(kw => lowerInput.includes(kw));
    if (hasComplexity) {
      return false; // Use 4 agents
    }
    
    // Check if simple
    const isSimple = simplePatterns.some(pattern => pattern.test(lowerInput));
    return isSimple;
  }

  /**
   * Get system prompt for simple queries (3 agents)
   */
  private getSimplePlannerPrompt(): string {
    return `You are the Planner Agent for SIMPLE factual queries (3 agents).

Your job: Break down user queries into 3 parallel subtasks:
1. **Analyst** (GPT-4o): Data analysis, logic, factual breakdowns
2. **Relational** (GPT-4o): Emotional context, user intent, empathy
3. **Verification** (Grok-4.1): Real-time fact-checking, web search

CRITICAL RULES:
- ALL 3 agents MUST participate (weights must sum to 1.0)
- Default weights: [0.40, 0.30, 0.30] (Analyst leads)
- Adjust based on query:
  - Pure facts: [0.45, 0.20, 0.35] (boost Verification)
  - Explanations: [0.50, 0.30, 0.20] (boost Analyst)
  - Personal questions: [0.35, 0.45, 0.20] (boost Relational)
- Be specific with subtasks

Output ONLY valid JSON:
{
  "tasks": [
    {"agent": "analyst", "subtask": "...", "weight": 0.40, "priority": 1},
    {"agent": "relational", "subtask": "...", "weight": 0.30, "priority": 1},
    {"agent": "verification", "subtask": "...", "weight": 0.30, "priority": 1}
  ],
  "strategy": "parallel",
  "reasoning": "Brief explanation"
}`;
  }

  /**
   * Get system prompt for complex queries (4 agents)
   */
  private getComplexPlannerPrompt(): string {
    return `You are the Planner Agent for COMPLEX queries (4 agents).

Your job: Break down user queries into 4 parallel subtasks:
1. **Analyst** (GPT-4o): Data analysis, logic, patterns, narratives
2. **Relational** (GPT-4o): Emotional intelligence, empathy, social dynamics
3. **Ethics** (GPT-4o): Moral reasoning, values, fairness, philosophy
4. **Verification** (Grok-4.1): Real-time fact-checking, web search

CRITICAL RULES:
- ALL 4 agents MUST participate (weights must sum to 1.0)
- Default balanced weights: [0.30, 0.25, 0.25, 0.20]
- Adjust based on query type:
  - Ethical/moral: [0.25, 0.25, 0.35, 0.15] (boost Ethics)
  - Emotional/personal: [0.25, 0.40, 0.20, 0.15] (boost Relational)
  - Factual/current: [0.35, 0.20, 0.15, 0.30] (boost Verification)
- **VERIFICATION PRIORITY**: Grok has veto power (confidence < 0.8 triggers re-jam)
- Be specific with subtasks

Output ONLY valid JSON:
{
  "tasks": [
    {"agent": "analyst", "subtask": "...", "weight": 0.25, "priority": 1},
    {"agent": "relational", "subtask": "...", "weight": 0.25, "priority": 1},
    {"agent": "ethics", "subtask": "...", "weight": 0.25, "priority": 1},
    {"agent": "verification", "subtask": "...", "weight": 0.25, "priority": 1}
  ],
  "strategy": "parallel",
  "reasoning": "Brief explanation"
}`;
  }

  /**
   * Detect if query requires factual verification (boosts Verification weight to 30%)
   */
  private isFactualQuery(query: string): boolean {
    const factualKeywords = [
      'who', 'what', 'when', 'where', 'current', 'latest', 'today', 'now',
      'president', 'election', 'news', 'verify', 'fact', 'true', 'false',
      'stock', 'price', 'weather', 'score', '2024', '2025', 'won', 'winner',
      'happened', 'breaking', 'recent'
    ];
    
    const lowerInput = query.toLowerCase();
    return factualKeywords.some(keyword => lowerInput.includes(keyword));
  }

  /**
   * Validate task plan and normalize weights to sum to 1.0
   */
  private validateAndNormalize(plan: TaskPlan, query: string): TaskPlan {
    // Accept both 3 and 4 agent plans
    const expectedCount = this.isSimpleQuery(query) ? 3 : 4;
    
    if (!plan.tasks || plan.tasks.length !== expectedCount) {
      this.logger.warn(`⚠️  Invalid task count (got ${plan.tasks?.length}, expected ${expectedCount}), using fallback`);
      return this.createBalancedFallback(query);
    }

    // Calculate total weight
    const totalWeight = plan.tasks.reduce((sum, task) => sum + (task.weight || 0), 0);

    // Normalize weights if needed
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      this.logger.log(`📊 Normalizing weights (was ${totalWeight.toFixed(2)}, target 1.0)`);
      plan.tasks.forEach(task => {
        task.weight = task.weight / totalWeight;
      });
    }

    // Ensure all required fields exist
    plan.tasks.forEach((task, index) => {
      if (!task.subtask) {
        task.subtask = `Process query: "${query}"`;
      }
      if (!task.priority) {
        task.priority = 1;
      }
    });

    return plan;
  }
}
