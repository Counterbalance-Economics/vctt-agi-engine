
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
   * @param query - User's input query
   * @param messages - Conversation history for context
   * @returns Task plan with agent assignments
   */
  async plan(query: string, messages: Message[]): Promise<TaskPlan> {
    const startTime = Date.now();
    this.logger.log('🎼 Planner Agent: Decomposing query into band parts...');

    const systemPrompt = `You are the Planner Agent, the "band leader" for a multi-agent AI system.

Your job: Break down user queries into parallel subtasks for 4 specialized agents:
1. **Analyst** (Claude 3.5): Data analysis, logic, patterns, narratives, factual breakdowns
2. **Relational** (GPT-5): Emotional intelligence, empathy, social dynamics, tone
3. **Ethics** (GPT-5): Moral reasoning, values, fairness, philosophical depth
4. **Verification** (Grok-3): Real-time fact-checking, web search, current events

CRITICAL RULES:
- ALL 4 agents MUST participate (weights must sum to 1.0)
- Default balanced weights: [0.25, 0.25, 0.25, 0.25]
- Adjust weights based on query type:
  - Factual/current events: Boost Verification (0.35) + Analyst (0.35)
  - Emotional/personal: Boost Relational (0.40) + Ethics (0.30)
  - Philosophical: Boost Ethics (0.40) + Analyst (0.30)
  - Complex analysis: Balance all equally (0.25 each)
- Be specific with subtasks - each agent needs clear instructions
- Use "parallel" strategy unless query requires sequential reasoning

Output ONLY valid JSON:
{
  "tasks": [
    {"agent": "analyst", "subtask": "...", "weight": 0.25, "priority": 1},
    {"agent": "relational", "subtask": "...", "weight": 0.25, "priority": 1},
    {"agent": "ethics", "subtask": "...", "weight": 0.25, "priority": 1},
    {"agent": "verification", "subtask": "...", "weight": 0.25, "priority": 1}
  ],
  "strategy": "parallel",
  "reasoning": "Brief explanation of task distribution"
}`;

    const userPrompt = `Decompose this query into 4 parallel agent tasks:

Query: "${query}"

Remember: All 4 agents must contribute. Output JSON only.`;

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
    this.logger.log('🛡️  Using balanced fallback task plan (25% each)');
    
    return {
      tasks: [
        {
          agent: 'analyst',
          subtask: `Analyze the factual content and logical structure of: "${query}"`,
          weight: 0.25,
          priority: 1,
        },
        {
          agent: 'relational',
          subtask: `Identify emotional context and empathetic considerations for: "${query}"`,
          weight: 0.25,
          priority: 1,
        },
        {
          agent: 'ethics',
          subtask: `Evaluate ethical dimensions and value implications of: "${query}"`,
          weight: 0.25,
          priority: 1,
        },
        {
          agent: 'verification',
          subtask: `Verify factual accuracy and provide current information about: "${query}"`,
          weight: 0.25,
          priority: 1,
        },
      ],
      strategy: 'parallel',
      reasoning: 'Balanced fallback - all agents contribute equally',
    };
  }

  /**
   * Validate task plan and normalize weights to sum to 1.0
   */
  private validateAndNormalize(plan: TaskPlan, query: string): TaskPlan {
    // Ensure we have exactly 4 tasks
    if (!plan.tasks || plan.tasks.length !== 4) {
      this.logger.warn('⚠️  Invalid task count, using fallback');
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
