
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
      
      const verificationQuery = `You are Grok-3 with real-time web search. Verify this query against CURRENT facts (November 2025):

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
      try {
        verifiedData = JSON.parse(verification.content);
      } catch (parseError) {
        this.logger.error(`❌ Failed to parse Grok JSON response: ${parseError.message}`);
        this.logger.error(`   Raw response: ${verification.content.substring(0, 200)}...`);
        // Fallback: use raw content if JSON parsing fails
        verifiedData = {
          content: verification.content,
          verified_facts: [],
          sources: [],
          confidence: 0.5
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
      
      this.logger.log(`✅ Early verification complete - discrepancy: ${hasDiscrepancy}`);
      this.logger.log(`   Verified facts: ${verifiedData.verified_facts?.join(', ') || 'none'}`);
      this.logger.log(`   Confidence: ${verifiedData.confidence || 'unknown'}`);
      
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
    grokVerification: any = null
  ): Promise<{ content: string; metadata?: any }> {
    this.logger.log('💬 Synthesiser Agent - generating coherent response');

    const conversationHistory = messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

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


CRITICAL: Your response MUST be valid JSON only. No prose, no explanations, no markdown.
Start with { and end with }. If you write anything other than JSON, the system will fail.
${verificationContext}`;

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
        content: finalResponse,
        metadata: {
          model: response.model,
          tokens_input: response.tokensUsed.input,
          tokens_output: response.tokensUsed.output,
          tokens_total: response.tokensUsed.total,
          cost_usd: response.cost,
          latency_ms: response.latencyMs,
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
