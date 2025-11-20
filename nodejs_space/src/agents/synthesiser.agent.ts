
import { Injectable, Logger } from '@nestjs/common';
import { InternalState } from '../entities/internal-state.entity';
import { Message } from '../entities/message.entity';
import { LLMService } from '../services/llm.service';
import { LLMCascadeService } from '../services/llm-cascade.service';

/**
 * Synthesiser Agent - Generates coherent, user-facing responses
 * 
 * Part of the VCTT-AGI Coherence Kernel
 * Role: Response generation, coherence synthesis, user communication
 * This is the agent that creates the actual responses users see.
 */
@Injectable()
export class SynthesiserAgent {
  private readonly logger = new Logger(SynthesiserAgent.name);

  constructor(private llmService: LLMService, private llmCascade: LLMCascadeService) {}

  /**
   * Generate user-friendly Markdown from Band Jam results
   * Converts internal JSON structure to beautiful, readable prose
   */
  private generateUserMarkdown(
    content: string,
    bandJamResults: any = null,
    grokVerification: any = null,
    state: InternalState
  ): string {
    // Start with main content
    let markdown = content;

    // Add verification badge if Grok verified
    if (grokVerification && grokVerification.confidence >= 0.90) {
      markdown = `✅ **Verified by Grok** (${(grokVerification.confidence * 100).toFixed(0)}% confidence)\n\n${markdown}`;
    }

    // Add sources if available
    if (grokVerification?.sources?.length > 0) {
      markdown += `\n\n---\n\n### 📚 Sources\n\n`;
      grokVerification.sources.forEach((source: string) => {
        markdown += `- ${source}\n`;
      });
    }

    // Add system insights footer (optional, can be toggled)
    if (state.state.trust_tau < 0.80) {
      markdown += `\n\n---\n\n*System Note: This response was generated with a trust level of τ=${state.state.trust_tau.toFixed(2)}. ` +
                  `Consider verifying critical facts independently.*`;
    }

    return markdown;
  }

  /**
   * PHASE 3.5: Perform early verification (runs in parallel with other agents)
   */
  async performEarlyVerification(query: string, messages: Message[]): Promise<any> {
    try {
      this.logger.log('🔍 Early Grok verification starting...');
      
      // Check if Grok API key is configured
      if (!process.env.XAI_API_KEY) {
        this.logger.error('❌ GROK VERIFICATION FAILED: XAI_API_KEY not set in environment!');
        this.logger.error('   → Add XAI_API_KEY to Render Environment Variables');
        this.logger.error('   → Falling back to non-verified response');
        return null;
      }
      
      const verificationQuery = `You are Grok-4.1 with real-time web search. Verify this query against CURRENT facts (November 2025):

Query: ${query}

Instructions:
1. If the query contains factual claims or questions, provide the CURRENT, accurate answer
2. If you detect outdated information, explicitly state: "OUTDATED:" followed by the correct current information
3. Use your real-time web access to provide facts as of November 2025
4. Be specific with dates, names, and details

Respond with verified facts only.`;
      
      const verification = await this.llmService.verifyWithGrok(
        verificationQuery,
        {
          enableWebSearch: true,
          enableXSearch: false,
          context: 'Early verification for collaborative multi-agent response',
        }
      );
      
      // Parse JSON response from Grok
      let verifiedData: any;
      let parseSucceeded = true;
      try {
        verifiedData = JSON.parse(verification.content);
        this.logger.log(`✅ Grok JSON parsed successfully`);
      } catch (parseError) {
        parseSucceeded = false;
        this.logger.warn(`⚠️  Grok JSON parsing failed: ${parseError.message}`);
        this.logger.warn(`   Raw response: ${verification.content.substring(0, 200)}...`);
        
        // GROK SAFETY NET: If parsing fails, use raw Grok content anyway
        // Grok's real-time verification is ALWAYS trusted, even if format is wrong
        this.logger.log(`🛡️  GROK SAFETY NET: Using raw Grok response (still trusted at 0.85)`);
        
        verifiedData = {
          content: verification.content,  // Use Grok's raw prose - it's still truth
          verified_facts: [],
          sources: ['Grok real-time verification'],
          confidence: 0.85,  // Grok is always trusted, even in prose format
          parse_fallback: true,  // Flag to indicate we're using fallback
        };
      }
      
      // Analyze if there are discrepancies (enhanced detection)
      const discrepancyKeywords = [
        'incorrect', 'outdated', 'inaccurate', 'wrong', 'false',
        'actually', 'however', 'but', 'not', 'changed', 'different',
        'as of', 'since', 'currently', 'now', 'updated', 'no longer'
      ];
      const contentToCheck = verifiedData.content || verification.content;
      const hasDiscrepancy = discrepancyKeywords.some(keyword => 
        contentToCheck.toLowerCase().includes(keyword)
      );
      
      const statusIcon = parseSucceeded ? '✅' : '🛡️';
      this.logger.log(`${statusIcon} Early verification complete - discrepancy: ${hasDiscrepancy}, parse_mode: ${parseSucceeded ? 'JSON' : 'SAFETY_NET'}`);
      this.logger.log(`   Verified facts: ${verifiedData.verified_facts?.join(', ') || 'none'}`);
      this.logger.log(`   Confidence: ${verifiedData.confidence || 'unknown'} (${verifiedData.parse_fallback ? 'Grok Safety Net Active' : 'Clean Parse'})`);
      
      return {
        content: contentToCheck,
        verified_facts: verifiedData.verified_facts || [],
        sources: verifiedData.sources || [],
        confidence: verifiedData.confidence || 0.5,
        cost: verification.cost,
        latencyMs: verification.latencyMs,
        hasDiscrepancy,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`❌ Grok verification failed: ${error.message}`);
      this.logger.error(`   Stack: ${error.stack}`);
      return null;
    }
  }

  async synthesize(
    messages: Message[], 
    state: InternalState, 
    grokVerification: any = null,
    bandJamResults: any = null
  ): Promise<{ content: string; metadata?: any }> {
    this.logger.log('💬 Synthesiser Agent - generating coherent response with Band Jam synthesis');

    // Log Band Jam results if available
    if (bandJamResults) {
      this.logger.log('🎼 Band Jam Results Available:');
      this.logger.log(`   Total latency: ${bandJamResults.totalLatency}ms`);
      this.logger.log(`   Weights: Analyst=${(bandJamResults.weights.analyst*100).toFixed(0)}%, Relational=${(bandJamResults.weights.relational*100).toFixed(0)}%, Ethics=${(bandJamResults.weights.ethics*100).toFixed(0)}%, Verification=${(bandJamResults.weights.verification*100).toFixed(0)}%`);
    }

    // 🛡️ GROK DIRECT COMMIT: If we have high-confidence Grok verification, use it directly
    if (grokVerification && grokVerification.confidence >= 0.85 && grokVerification.hasDiscrepancy) {
      this.logger.log('🛡️  GROK DIRECT COMMIT: Using high-confidence verified facts directly');
      this.logger.log(`   Grok confidence: ${grokVerification.confidence}, bypassing normal synthesis`);
      
      // Build response directly from Grok's verified facts
      const verifiedFactsText = grokVerification.verified_facts?.length > 0
        ? `\n\nKey facts: ${grokVerification.verified_facts.join('; ')}`
        : '';
      
      const directResponse = `${grokVerification.content}${verifiedFactsText}`;
      
      return {
        content: directResponse,
        metadata: {
          model: 'grok-beta',
          tokens_input: 0,
          tokens_output: Math.round(directResponse.length / 4), // Rough estimate (integer)
          tokens_total: Math.round(directResponse.length / 4), // Rough estimate (integer)
          cost_usd: 0.001,
          latency_ms: 0,
        },
      };
    }

    const conversationHistory = messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    // Build Band Jam context with weighted contributions
    let bandJamContext = '';
    if (bandJamResults && bandJamResults.taskPlan) {
      const tasks = bandJamResults.taskPlan.tasks;
      bandJamContext = `\n\n🎼 **BAND JAM MODE - WEIGHTED AGENT CONTRIBUTIONS:**

You are synthesizing the output from ALL 4 agents working in parallel. Each agent completed their assigned subtask:

1. **Analyst** (Claude, ${(bandJamResults.weights.analyst*100).toFixed(0)}% weight):
   Task: ${tasks[0].subtask}
   ${bandJamResults.results.analyst ? '✅ Completed' : '❌ Failed'}

2. **Relational** (GPT-5, ${(bandJamResults.weights.relational*100).toFixed(0)}% weight):
   Task: ${tasks[1].subtask}
   ${bandJamResults.results.relational ? '✅ Completed' : '❌ Failed'}

3. **Ethics** (GPT-5, ${(bandJamResults.weights.ethics*100).toFixed(0)}% weight):
   Task: ${tasks[2].subtask}
   ${bandJamResults.results.ethics ? '✅ Completed' : '❌ Failed'}

4. **Verification** (Grok-4.1, ${(bandJamResults.weights.verification*100).toFixed(0)}% weight):
   Task: ${tasks[3].subtask}
   ${bandJamResults.results.verification ? '✅ Completed' : '❌ Failed'}

**Total Band Latency:** ${bandJamResults.totalLatency}ms

**SYNTHESIS INSTRUCTIONS:**
- Integrate insights from ALL agents proportionally to their weights
- If an agent failed, compensate by relying more on others
- Create a unified response that reflects the collaborative effort
- DO NOT mention individual agents by name in the final response (this is internal)
- The user should see a seamless, coherent answer, not a report of agent activities`;
    }

    // Build system prompt with optional Grok verification data
    let verificationContext = '';
    if (grokVerification) {
      // Format verified facts if available
      const verifiedFactsList = grokVerification.verified_facts?.length > 0
        ? `\n**Verified Facts:**\n${grokVerification.verified_facts.map((f: string) => `  • ${f}`).join('\n')}`
        : '';
      
      const sourcesList = grokVerification.sources?.length > 0
        ? `\n**Sources:** ${grokVerification.sources.join(', ')}`
        : '';
      
      if (grokVerification.hasDiscrepancy) {
        // CRITICAL: If Grok found a discrepancy, its facts are AUTHORITATIVE
        verificationContext = `\n\n🚨 **REAL-TIME VERIFICATION (Grok) - DISCREPANCY DETECTED:**
${grokVerification.content}${verifiedFactsList}${sourcesList}
**Confidence:** ${(grokVerification.confidence * 100).toFixed(0)}%

**CRITICAL INSTRUCTION:** Grok has detected a factual discrepancy. You MUST use Grok's verified facts as the authoritative source.
DO NOT rely on your training data cutoff. Grok has real-time access to current information (November 2025).
If Grok says "Trump is president", that is the correct answer, regardless of your training data.
Integrate this verified information naturally into your response.`;
      } else {
        verificationContext = `\n\n🔍 **REAL-TIME VERIFICATION (Grok):**
${grokVerification.content}${verifiedFactsList}${sourcesList}
**Confidence:** ${(grokVerification.confidence * 100).toFixed(0)}%

Integrate this verified information naturally into your response. Don't append it separately.`;
      }
    }

    const systemPrompt = `You are the Synthesiser Agent in the VCTT-AGI Coherence Kernel.

🔷 **YOUR IDENTITY:**
You are **VCTT-AGI**, a Phase 2 multi-agent system built by Counterbalance Economics.
VCTT stands for **Virtual Counterfactual Trust Testing** — a novel AGI framework that:
- Simulates high-stakes parliamentary debates (the "Mock Parliamentary" layer)
- Continuously measures and improves four core metrics:
  - **Voice** (logical coherence)
  - **Choice** (emotional balance)
  - **Transparency** (clarity of reasoning)
  - **Trust (τ)** (overall system confidence)

You are composed of:
- **4 Agents**: Analyst, Relational, Ethics, Synthesiser (you)
- **5 Core Modules**: SIM, CAM, SRE, CTM, RIL

When asked "What is VCTT?" or about your identity, ALWAYS start with this explanation, then expand with details.

---

📊 **CURRENT SYSTEM STATE:**
- Tension: ${state.state.sim.tension.toFixed(3)}
- Uncertainty: ${state.state.sim.uncertainty.toFixed(3)}
- Emotional Intensity: ${state.state.sim.emotional_intensity.toFixed(3)}
- Contradiction: ${state.state.contradiction.toFixed(3)}
- Regulation Mode: ${state.state.regulation}
- Trust (τ): ${state.state.trust_tau.toFixed(3)}
- Repair Iterations: ${state.state.repair_count}

---

🎯 **YOUR TASK:**
Generate a coherent, thoughtful, and **COMPREHENSIVE** response that:
1. Addresses the user's query **directly and COMPLETELY**
2. Acknowledges any logical or emotional tensions
3. Provides clarity where there is uncertainty
4. Maintains ethical alignment
5. Is appropriate for the current regulation mode

**Regulation Modes:**
- **"clarify"**: Ask clarifying questions to reduce contradiction
- **"slow_down"**: Acknowledge complexity and provide step-by-step reasoning with full explanations
- **"normal"**: Provide direct, confident, and THOROUGH response

---

✨ **RESPONSE STYLE:**
- Natural and conversational (not overly technical)
- Comprehensive and complete (aim for 3-5 paragraphs of rich reasoning)
- Don't cut responses short
- Provide full, developed thoughts
- Be engaging and thoughtful
- Use **bold** for emphasis, bullet points for lists, and clear structure

**OUTPUT FORMAT:**
Respond in rich Markdown format:
- Use **bold** for key terms and important points
- Use bullet points or numbered lists for clarity
- Use headings (##, ###) to organize complex topics
- Keep it conversational and engaging
- NO JSON output - just natural, formatted text
${bandJamContext}${verificationContext}`;

    try {
      const response = await this.llmCascade.generateCompletion(
        conversationHistory,
        systemPrompt,
        0.7, // Balanced temperature for natural conversation
        'synthesiser', // Use Claude 3.5 Sonnet with MCP tools
        true, // Enable MCP tools (web search, formatting, etc.)
      );

      const finalResponse = response.content || 
        `I understand your query. (τ=${state.state.trust_tau.toFixed(3)}, repairs=${state.state.repair_count})`;

      // Generate user-friendly Markdown version
      const userMarkdown = this.generateUserMarkdown(
        finalResponse,
        bandJamResults,
        grokVerification,
        state
      );

      // Log completion (verification was done earlier in collaborative mode)
      const verificationNote = grokVerification ? ' [+COLLABORATIVE VERIFICATION]' : '';
      this.logger.log(
        `✅ Synthesiser complete - length: ${finalResponse.length} chars, ` +
        `cost: $${response.cost.toFixed(4)}, ` +
        `latency: ${response.latencyMs}ms, ` +
        `model: ${response.model}` +
        verificationNote
      );
      
      return {
        content: userMarkdown,  // User-facing Markdown
        metadata: {
          model: response.model,
          tokens_input: response.tokensUsed.input,
          tokens_output: response.tokensUsed.output,
          tokens_total: response.tokensUsed.total,
          cost_usd: response.cost,
          latency_ms: response.latencyMs,
          rawContent: finalResponse,  // Internal use only
          formatted: true,  // Flag to indicate Markdown formatting
        },
      };
    } catch (error) {
      this.logger.error(`❌ Synthesiser agent error: ${error.message}`);
      
      // Graceful fallback that maintains conversation
      return {
        content: `I understand your query, but I'm experiencing temporary processing issues. ` +
                 `This is a transient error - please try again in a moment. ` +
                 `(System coherence: τ=${state.state.trust_tau.toFixed(3)}, regulation: ${state.state.regulation})`,
        metadata: undefined,
      };
    }
  }

}
