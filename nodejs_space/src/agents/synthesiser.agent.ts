
import { Injectable, Logger } from '@nestjs/common';
import { InternalState } from '../entities/internal-state.entity';
import { Message } from '../entities/message.entity';
import { LLMService } from '../services/llm.service';

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

  constructor(private llmService: LLMService) {}

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
      
      const verificationQuery = `Verify the following query with current, accurate information. Identify any potential inaccuracies or outdated assumptions:\n\n${query}`;
      
      const verification = await this.llmService.verifyWithGrok(
        verificationQuery,
        {
          enableWebSearch: true,
          enableXSearch: false,
          context: 'Early verification for collaborative multi-agent response',
        }
      );
      
      // Analyze if there are discrepancies
      const hasDiscrepancy = verification.content.toLowerCase().includes('incorrect') || 
                             verification.content.toLowerCase().includes('outdated') ||
                             verification.content.toLowerCase().includes('inaccurate');
      
      this.logger.log(`✅ Early verification complete - discrepancy: ${hasDiscrepancy}`);
      
      return {
        content: verification.content,
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
      verificationContext = `\n\n🔍 **REAL-TIME VERIFICATION (Grok):**\n${grokVerification.content}\n\nIntegrate this verified information naturally into your response. Don't append it separately.`;
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

${verificationContext}`;

    try {
      const response = await this.llmService.generateCompletion(
        conversationHistory,
        systemPrompt,
        0.7, // Balanced temperature for natural conversation
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
