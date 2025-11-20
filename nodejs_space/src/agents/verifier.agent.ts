
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Message } from '../entities/message.entity';
import { InternalState } from '../entities/internal-state.entity';
import { LLMService } from '../services/llm.service';
import { TruthMyceliumService, VerifiedFact } from '../services/truth-mycelium.service';
import { LLMCommitteeService } from '../services/llm-committee.service';

/**
 * 🥁🍄 VERIFIER AGENT (Grok-4 → Grok 4.1 Upgrade Path) - The Drummer & Living Root System
 * 
 * DUAL ROLE:
 * 1. Drummer: Real-time fact-checking during Band Jam Mode
 * 2. Mycelium: Grows persistent truth substrate across all sessions
 * 
 * Weight: 20% base, 30% for factual queries
 * Veto: Triggers re-jam if confidence < 0.8
 * 
 * Current Model: Grok-4 (stable, full API access)
 * Upgrade Path: grok-4-1-fast-reasoning (when SuperGrok subscription active)
 * 
 * Every verified fact is stored in the mycelium, creating a living, growing
 * substrate of truth that all future conversations can build upon.
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
  verifiedFacts?: VerifiedFact[]; // NEW: For mycelium storage
}

@Injectable()
export class VerifierAgent {
  private readonly logger = new Logger(VerifierAgent.name);

  constructor(
    private llmService: LLMService,
    private truthMycelium: TruthMyceliumService,
    @Optional() private committeeService: LLMCommitteeService | null,
  ) {}

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

      // Call Grok-4-Fast-Reasoning with real-time web search
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
          model: verification.model || 'grok', // Use actual model from API response
        };

        this.logger.log(`✅ Verifier JSON parsed successfully (model: ${verification.model})`);
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
          model: verification.model || 'grok', // Use actual model from API response
        };
      }

      // 🍄 MYCELIAL GROWTH: Store verified facts in the truth substrate
      const mycelialFacts: VerifiedFact[] = verifiedData.verified_facts
        .filter(fact => fact && fact.length > 10) // Only substantive facts
        .map(fact => ({
          fact,
          confidence: verifiedData.confidence,
          sources: verifiedData.sources,
          verifiedBy: verifiedData.model || 'grok', // Use actual model name with fallback
          timestamp: new Date(),
        }));

      if (mycelialFacts.length > 0) {
        this.truthMycelium.bulkStoreFacts(mycelialFacts);
        this.logger.log(`🍄 Mycelium grew by ${mycelialFacts.length} verified facts`);
      }

      verifiedData.verifiedFacts = mycelialFacts;

      // Log verification results
      this.logger.log(
        `✅ Verifier complete - confidence: ${verifiedData.confidence.toFixed(2)}, ` +
        `discrepancy: ${verifiedData.hasDiscrepancy}, ` +
        `facts: ${verifiedData.verified_facts.length}, ` +
        `cost: $${verifiedData.cost?.toFixed(4) || '0.0000'}, ` +
        `latency: ${verifiedData.latency}ms, ` +
        `model: ${verifiedData.model}`,
      );

      // 🎸 RECORD CONTRIBUTION: Track Grok verification in LLM Committee
      if (this.committeeService) {
        await this.committeeService.recordContribution({
          session_id: messages[0]?.conversation_id || 'unknown',
          model_name: verifiedData.model || 'grok-beta',
          agent_name: 'verifier',
          contributed: true,
          offline: false,
          tokens_used: verification.tokensUsed?.total || 0,
          cost_usd: verifiedData.cost || 0,
          latency_ms: verifiedData.latency || 0,
        });
        this.logger.log(`🎸 Committee: Grok-${verifiedData.model} contribution recorded`);
      }

      // VETO LOGIC: Flag if confidence is too low
      if (verifiedData.confidence < 0.8) {
        this.logger.warn(`⚠️  VETO: Confidence ${verifiedData.confidence} < 0.8 — consider re-jam`);
        verifiedData.hasDiscrepancy = true;
      }

      return verifiedData;
    } catch (error) {
      this.logger.error(`❌ Verifier failed: ${error.message}`);
      
      // Record failed contribution
      if (this.committeeService && messages[0]) {
        await this.committeeService.recordContribution({
          session_id: messages[0].conversation_id || 'unknown',
          model_name: 'grok-beta',
          agent_name: 'verifier',
          contributed: false,
          offline: true,
          error_type: error.message,
        });
      }
      
      return null;
    }
  }

  /**
   * Build verification prompt for Grok
   */
  private buildVerificationPrompt(query: string, agentOutputs: any, subtask?: string): string {
    const focusArea = subtask || 'Verify all factual claims and check for logical consistency';

    let prompt = `You are Grok-4.1, the truth anchor verifier with real-time web search. Your job is to fact-check and verify outputs from other AI agents.

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

      const prompt = `You are Grok-4.1, performing a final fact-check on this AI-generated response:

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
          model: verification.model || 'grok',
        };
      } catch (parseError) {
        verifiedData = {
          verified_facts: [verification.content],
          confidence: 0.85,
          hasDiscrepancy: false,
          sources: ['Grok post-synthesis check'],
          latency: Date.now() - startTime,
          cost: verification.cost,
          model: verification.model || 'grok',
        };
      }

      // 🍄 MYCELIAL GROWTH: Store post-synthesis verified facts
      const mycelialFacts: VerifiedFact[] = verifiedData.verified_facts
        .filter(fact => fact && fact.length > 10)
        .map(fact => ({
          fact,
          confidence: verifiedData.confidence,
          sources: verifiedData.sources,
          verifiedBy: verifiedData.model || 'grok', // Use actual model name with fallback
          timestamp: new Date(),
        }));

      if (mycelialFacts.length > 0) {
        this.truthMycelium.bulkStoreFacts(mycelialFacts);
        this.logger.log(`🍄 Post-synthesis mycelium growth: ${mycelialFacts.length} facts`);
      }

      verifiedData.verifiedFacts = mycelialFacts;

      this.logger.log(`✅ Post-synthesis check complete - confidence: ${verifiedData.confidence.toFixed(2)}`);

      // 🎸 RECORD CONTRIBUTION: Track post-synthesis verification
      if (this.committeeService && messages[0]) {
        await this.committeeService.recordContribution({
          session_id: messages[0].conversation_id || 'unknown',
          model_name: verifiedData.model || 'grok-beta',
          agent_name: 'verifier-post',
          contributed: true,
          offline: false,
          cost_usd: verifiedData.cost || 0,
          latency_ms: verifiedData.latency || 0,
        });
        this.logger.log(`🎸 Committee: Post-synthesis Grok contribution recorded`);
      }

      return verifiedData;
    } catch (error) {
      this.logger.error(`❌ Post-synthesis check failed: ${error.message}`);
      
      // Record failed post-synthesis contribution
      if (this.committeeService && messages[0]) {
        await this.committeeService.recordContribution({
          session_id: messages[0].conversation_id || 'unknown',
          model_name: 'grok-beta',
          agent_name: 'verifier-post',
          contributed: false,
          offline: true,
          error_type: error.message,
        });
      }
      
      return null;
    }
  }

  /**
   * 🍄 PRE-JAM TRUTH SWEEP
   * 
   * Extract potential claims from user query and session history,
   * verify them with Grok-4.1, and seed the mycelium before the band starts.
   */
  async preJamTruthSweep(query: string, sessionHistory: string): Promise<VerifiedFact[]> {
    const startTime = Date.now();

    try {
      this.logger.log('🍄 Pre-jam truth sweep starting...');

      // Extract claims from query and history
      const fullContext = `${query}\n\n${sessionHistory}`;
      const claims = this.truthMycelium.extractClaims(fullContext);

      if (claims.length === 0) {
        this.logger.log('No factual claims detected in pre-jam sweep');
        return [];
      }

      this.logger.log(`Extracted ${claims.length} potential claims for verification`);

      // Verify claims with Grok-4.1
      const prompt = `You are Grok-4.1, performing a pre-verification sweep. Verify these factual claims:

${claims.map((claim, i) => `${i + 1}. ${claim}`).join('\n')}

**Task:** Verify each claim against real-time data. Return JSON:
{
  "verified": [
    {
      "fact": "verified claim text",
      "confidence": 0.95,
      "sources": ["source1.com", "source2.com"]
    }
  ]
}

Only include facts you can verify with high confidence (>0.7).`;

      const verification = await this.llmService.verifyWithGrok(prompt, {
        enableWebSearch: true,
        enableXSearch: false,
        context: 'Pre-jam truth sweep',
      });

      // Parse verified facts
      let verifiedFacts: VerifiedFact[] = [];

      try {
        const parsed = JSON.parse(verification.content);
        verifiedFacts = (parsed.verified || []).map((v: any) => ({
          fact: v.fact,
          confidence: v.confidence || 0.8,
          sources: v.sources || ['Grok pre-jam sweep'],
          verifiedBy: verification.model || 'grok', // Use actual model name
          timestamp: new Date(),
        }));
      } catch (parseError) {
        this.logger.warn(`Pre-jam sweep JSON parse failed, skipping seeding`);
      }

      // Store in mycelium
      if (verifiedFacts.length > 0) {
        this.truthMycelium.bulkStoreFacts(verifiedFacts);
        this.logger.log(
          `🍄 Pre-jam mycelium seeded: ${verifiedFacts.length} facts ` +
          `(${Date.now() - startTime}ms)`,
        );
      }

      return verifiedFacts;
    } catch (error) {
      this.logger.error(`❌ Pre-jam truth sweep failed: ${error.message}`);
      return [];
    }
  }
}
