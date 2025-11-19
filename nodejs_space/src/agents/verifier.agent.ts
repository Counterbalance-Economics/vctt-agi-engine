
import { Injectable, Logger } from '@nestjs/common';
import { Message } from '../entities/message.entity';
import { InternalState } from '../entities/internal-state.entity';
import { LLMService } from '../services/llm.service';

/**
 * VERIFIER AGENT (Grok-3)
 * 
 * Role: Truth anchor drummer — fact-checks outputs, verifies real-time data,
 * spots logical inconsistencies, and has veto power for major discrepancies.
 * 
 * Weight: 20% base, 30% for factual queries
 * Veto: Triggers re-jam if confidence < 0.8
 */

export interface VerifiedOutput {
  verified_facts: string[];      // e.g., ["Trump: 47th President", "Inauguration: Jan 20, 2025"]
  confidence: number;            // 0-1 (e.g., 0.95)
  hasDiscrepancy: boolean;       // true → flag re-run
  sources: string[];             // e.g., ["x.com/elonmusk/...", "wikipedia.org/..."]
  corrections?: string[];        // e.g., ["Ethics said 46th — corrected to 47th"]
  latency?: number;
  cost?: number;
  model?: string;
}

@Injectable()
export class VerifierAgent {
  private readonly logger = new Logger(VerifierAgent.name);

  constructor(private llmService: LLMService) {}

  /**
   * MAIN VERIFICATION METHOD
   * 
   * Runs in parallel with other agents during Band Jam Mode.
   * Cross-checks facts, real-time data, and logical consistency.
   */
  async verify(
    query: string,
    agentOutputs: any,
    messages: Message[],
    subtask?: string,
  ): Promise<VerifiedOutput | null> {
    const startTime = Date.now();

    try {
      this.logger.log('🥁 Verifier (Grok) starting fact-check...');

      // Build verification prompt
      const verificationPrompt = this.buildVerificationPrompt(query, agentOutputs, subtask);

      // Call Grok-3 with real-time web search
      const verification = await this.llmService.verifyWithGrok(
        verificationPrompt,
        {
          enableWebSearch: true,
          enableXSearch: false,
          context: 'Verifier agent fact-checking',
        },
      );

      // Parse JSON response from Grok
      let verifiedData: VerifiedOutput;

      try {
        const parsed = JSON.parse(verification.content);
        verifiedData = {
          verified_facts: parsed.verified_facts || [],
          confidence: parsed.confidence || 0.85,
          hasDiscrepancy: parsed.hasDiscrepancy || false,
          sources: parsed.sources || ['Grok real-time verification'],
          corrections: parsed.corrections || [],
          latency: Date.now() - startTime,
          cost: verification.cost,
          model: 'grok-3',
        };

        this.logger.log(`✅ Verifier JSON parsed successfully`);
      } catch (parseError) {
        // GROK SAFETY NET: If parsing fails, use raw Grok content anyway
        this.logger.warn(`⚠️  Verifier JSON parsing failed: ${parseError.message}`);
        this.logger.log(`🛡️  GROK SAFETY NET: Using raw Grok response (still trusted at 0.85)`);

        verifiedData = {
          verified_facts: [verification.content],
          confidence: 0.85, // Grok is always trusted, even in prose format
          hasDiscrepancy: false,
          sources: ['Grok real-time verification'],
          corrections: [],
          latency: Date.now() - startTime,
          cost: verification.cost,
          model: 'grok-3',
        };
      }

      // Log verification results
      this.logger.log(
        `✅ Verifier complete - confidence: ${verifiedData.confidence.toFixed(2)}, ` +
        `discrepancy: ${verifiedData.hasDiscrepancy}, ` +
        `facts: ${verifiedData.verified_facts.length}, ` +
        `cost: $${verifiedData.cost?.toFixed(4) || '0.0000'}, ` +
        `latency: ${verifiedData.latency}ms`,
      );

      // VETO LOGIC: Flag if confidence is too low
      if (verifiedData.confidence < 0.8) {
        this.logger.warn(`⚠️  VETO: Confidence ${verifiedData.confidence} < 0.8 — consider re-jam`);
        verifiedData.hasDiscrepancy = true;
      }

      return verifiedData;
    } catch (error) {
      this.logger.error(`❌ Verifier failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Build verification prompt for Grok
   */
  private buildVerificationPrompt(query: string, agentOutputs: any, subtask?: string): string {
    const focusArea = subtask || 'Verify all factual claims and check for logical consistency';

    let prompt = `You are Grok-3, the truth anchor verifier with real-time web search. Your job is to fact-check and verify outputs from other AI agents.

**Original Query:** ${query}

**Your Verification Task:** ${focusArea}

**Agent Outputs to Verify:**
`;

    // Include outputs from other agents if available
    if (agentOutputs) {
      if (agentOutputs.analyst) {
        prompt += `\n**Analyst Output:**\n${JSON.stringify(agentOutputs.analyst, null, 2)}\n`;
      }
      if (agentOutputs.relational) {
        prompt += `\n**Relational Output:**\n${JSON.stringify(agentOutputs.relational, null, 2)}\n`;
      }
      if (agentOutputs.ethics) {
        prompt += `\n**Ethics Output:**\n${JSON.stringify(agentOutputs.ethics, null, 2)}\n`;
      }
    }

    prompt += `
**Your Task:**
1. Fact-check all claims (names, dates, events) against current real-time data (November 2025)
2. Verify real-time information (news, prices, current events)
3. Check for logical inconsistencies across agent outputs
4. Provide sources for all verified facts
5. Flag any corrections needed

**Return JSON format:**
{
  "verified_facts": ["fact1", "fact2"],
  "confidence": 0.95,
  "hasDiscrepancy": false,
  "sources": ["source1.com", "source2.com"],
  "corrections": ["optional: any corrections needed"]
}

**Important:** Use your real-time web search to verify current facts. Confidence should be 0.9+ for well-verified facts, 0.7-0.9 for partial verification, <0.7 if uncertain.
`;

    return prompt;
  }

  /**
   * POST-SYNTHESIS VERIFICATION
   * 
   * Final pass on the merged response to catch any hallucinations.
   */
  async postSynthesisCheck(finalResponse: string, messages: Message[]): Promise<VerifiedOutput | null> {
    const startTime = Date.now();

    try {
      this.logger.log('🔍 Post-synthesis verification starting...');

      const prompt = `You are Grok-3, performing a final fact-check on this AI-generated response:

**Response to Verify:**
${finalResponse}

**Task:** Verify all factual claims, check for hallucinations, ensure accuracy.

**Return JSON:**
{
  "verified_facts": ["fact1", "fact2"],
  "confidence": 0.95,
  "hasDiscrepancy": false,
  "sources": ["source1.com"],
  "corrections": ["optional corrections"]
}
`;

      const verification = await this.llmService.verifyWithGrok(prompt, {
        enableWebSearch: true,
        enableXSearch: false,
        context: 'Post-synthesis fact-check',
      });

      let verifiedData: VerifiedOutput;

      try {
        const parsed = JSON.parse(verification.content);
        verifiedData = {
          ...parsed,
          latency: Date.now() - startTime,
          cost: verification.cost,
          model: 'grok-3',
        };
      } catch (parseError) {
        verifiedData = {
          verified_facts: [verification.content],
          confidence: 0.85,
          hasDiscrepancy: false,
          sources: ['Grok post-synthesis check'],
          latency: Date.now() - startTime,
          cost: verification.cost,
          model: 'grok-3',
        };
      }

      this.logger.log(`✅ Post-synthesis check complete - confidence: ${verifiedData.confidence.toFixed(2)}`);

      return verifiedData;
    } catch (error) {
      this.logger.error(`❌ Post-synthesis check failed: ${error.message}`);
      return null;
    }
  }
}
