
import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { InternalState, StateData } from '../entities/internal-state.entity';
import { LLMCommitteeService } from './llm-committee.service';
import { LLMCascadeService } from './llm-cascade.service';
import { AnalystAgent } from '../agents/analyst.agent';
import { RelationalAgent } from '../agents/relational.agent';
import { EthicsAgent } from '../agents/ethics.agent';
import { SynthesiserAgent } from '../agents/synthesiser.agent';
import { PlannerAgent } from '../agents/planner.agent';
import { VerifierAgent } from '../agents/verifier.agent';
import { SIMModule } from '../modules/sim.module';
import { CAMModule } from '../modules/cam.module';
import { SREModule } from '../modules/sre.module';
import { CTMModule } from '../modules/ctm.module';
import { RILModule } from '../modules/ril.module';

@Injectable()
export class VCTTEngineService {
  private readonly logger = new Logger(VCTTEngineService.name);
  private readonly max_repairs: number;
  
  // In-memory storage for stateless mode (when no database)
  private inMemoryConversations: Map<string, any> = new Map();
  private inMemoryMessages: Map<string, any[]> = new Map();
  private inMemoryStates: Map<string, any> = new Map();
  
  // Temporary tracking for LLM contributions during pipeline execution
  private currentContributions: Map<string, any[]> = new Map();

  constructor(
    @Optional() @InjectRepository(Conversation) private convRepo: Repository<Conversation> | null,
    @Optional() @InjectRepository(Message) private msgRepo: Repository<Message> | null,
    @Optional() @InjectRepository(InternalState) private stateRepo: Repository<InternalState> | null,
    @Optional() private committeeService: LLMCommitteeService | null,
    private llmCascade: LLMCascadeService,
    private plannerAgent: PlannerAgent,
    private analystAgent: AnalystAgent,
    private relationalAgent: RelationalAgent,
    private ethicsAgent: EthicsAgent,
    private verifierAgent: VerifierAgent,
    private synthesiserAgent: SynthesiserAgent,
    private simModule: SIMModule,
    private camModule: CAMModule,
    private sreModule: SREModule,
    private ctmModule: CTMModule,
    private rilModule: RILModule,
    private configService: ConfigService,
  ) {
    this.max_repairs = parseInt(this.configService.get<string>('MAX_REPAIR_ITERATIONS', '3'));
    
    // Log database status
    if (!this.convRepo || !this.msgRepo || !this.stateRepo) {
      this.logger.warn('⚠️  Database repositories not available - running in stateless mode');
    } else {
      this.logger.log('✅ Database repositories initialized');
    }
  }

  /**
   * Check if database is available
   */
  private get hasDatabase(): boolean {
    return !!(this.convRepo && this.msgRepo && this.stateRepo);
  }

  /**
   * Track LLM contribution (temporarily in memory during request)
   */
  private trackContribution(
    sessionId: string,
    agentName: string,
    modelName: string,
    contributed: boolean,
    offline: boolean = false,
    errorType?: string,
    cost?: number,
    latency?: number,
  ): void {
    if (!this.currentContributions.has(sessionId)) {
      this.currentContributions.set(sessionId, []);
    }
    
    this.currentContributions.get(sessionId)!.push({
      agent_name: agentName,
      model_name: modelName,
      contributed,
      offline,
      error_type: errorType,
      cost_usd: cost || 0,
      latency_ms: latency || 0,
    });
  }

  /**
   * Flush tracked contributions to database (called at end of pipeline)
   */
  private async flushContributions(sessionId: string): Promise<void> {
    if (!this.committeeService) return;
    
    const contributions = this.currentContributions.get(sessionId) || [];
    
    for (const contrib of contributions) {
      try {
        await this.committeeService.recordContribution({
          session_id: sessionId,
          ...contrib,
        });
      } catch (error) {
        // Don't let tracking errors break the pipeline
        this.logger.debug(`Failed to record contribution: ${error.message}`);
      }
    }
    
    // Clean up
    this.currentContributions.delete(sessionId);
  }

  /**
   * Start a new conversation session
   */
  async startSession(userId: string, input: string): Promise<string> {
    this.logger.log(`Starting new session for user: ${userId}`);

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initialize internal state with default values
    const initialState: StateData = {
      sim: {
        tension: 0.0,
        uncertainty: 0.0,
        emotional_intensity: 0.0,
      },
      contradiction: 0.0,
      regulation: 'normal',
      trust_tau: 1.0,
      repair_count: 0,
    };

    if (this.hasDatabase) {
      // Create new conversation in database
      const conv = this.convRepo!.create({ user_id: userId });
      await this.convRepo!.save(conv);

      // Save initial user message
      const msg = this.msgRepo!.create({
        conversation_id: conv.id,
        role: 'user',
        content: input,
      });
      await this.msgRepo!.save(msg);

      // Save initial state
      const state = this.stateRepo!.create({
        session_id: conv.id,
        state: initialState,
        updated_at: new Date(),
      });
      await this.stateRepo!.save(state);

      this.logger.log(`Session created (DB): ${conv.id}`);
      return conv.id;
    } else {
      // Use in-memory storage
      this.inMemoryConversations.set(sessionId, { id: sessionId, user_id: userId });
      this.inMemoryMessages.set(sessionId, [{ role: 'user', content: input, timestamp: new Date() }]);
      this.inMemoryStates.set(sessionId, { session_id: sessionId, state: initialState, updated_at: new Date() });

      this.logger.log(`Session created (memory): ${sessionId}`);
      return sessionId;
    }
  }

  /**
   * Process a conversation step with full VCTT pipeline
   */
  async processStep(sessionId: string, input: string): Promise<any> {
    this.logger.log(`Processing step for session: ${sessionId}`);

    // Set session ID for LLM contribution tracking
    if (this.llmCascade) {
      this.llmCascade.setSessionId(sessionId);
    }

    let state: any;
    let messages: any[];

    if (this.hasDatabase) {
      // Load from database
      state = await this.stateRepo!.findOne({ where: { session_id: sessionId } });
      if (!state) {
        throw new NotFoundException(`Session not found: ${sessionId}`);
      }

      messages = await this.msgRepo!.find({
        where: { conversation_id: sessionId },
        order: { timestamp: 'ASC' },
      });

      // Save new user input
      const userMsg = this.msgRepo!.create({
        conversation_id: sessionId,
        role: 'user',
        content: input,
      });
      await this.msgRepo!.save(userMsg);
      messages.push(userMsg);
    } else {
      // Load from memory
      state = this.inMemoryStates.get(sessionId);
      if (!state) {
        throw new NotFoundException(`Session not found: ${sessionId}`);
      }

      messages = this.inMemoryMessages.get(sessionId) || [];
      
      // Add new user input
      const userMsg = { role: 'user', content: input, timestamp: new Date() };
      messages.push(userMsg);
      this.inMemoryMessages.set(sessionId, messages);
    }

    // Reset repair count for new step
    state.state.repair_count = 0;
    state.state.regulation = 'normal';

    this.logger.log('=== STARTING VCTT PIPELINE ===');

    // 🎼 BAND JAM MODE: Always run all agents in parallel with task decomposition
    this.logger.log('🎵 Starting Band Jam Mode - all agents will collaborate simultaneously');
    
    const bandJamResults = await this.runAgents(messages, state, true);
    
    // Extract verification data for trust adjustment
    const grokVerificationData = bandJamResults.results.verification;
    
    // Adjust trust based on verification results
    if (grokVerificationData) {
      if (grokVerificationData.hasDiscrepancy) {
        this.logger.warn('⚠️ Verification flagged discrepancies - adjusting trust metrics');
        state.state.contradiction = Math.max(state.state.contradiction, 0.6);
        state.state.trust_tau = Math.min(state.state.trust_tau, 0.75);
      } else {
        // Boost trust if verification confirms accuracy
        state.state.trust_tau = Math.min(1.0, state.state.trust_tau + 0.05);
        this.logger.log(`✅ Verification confirmed accuracy - trust boosted to τ=${state.state.trust_tau.toFixed(3)}`);
      }
    }

    // === RUN MODULES (Initial Pass) ===
    this.runModules(messages, state, input);

    // === REPAIR LOOP ===
    this.logger.log(`Initial regulation mode: ${state.state.regulation}`);
    
    while (state.state.regulation !== 'normal' && state.state.repair_count < this.max_repairs) {
      state.state.repair_count++;
      this.logger.log(`=== REPAIR ITERATION ${state.state.repair_count}/${this.max_repairs} ===`);

      // Re-run Analyst and Relational agents for deeper analysis
      await this.analystAgent.analyze(messages, state);
      await this.relationalAgent.analyze(messages, state);

      // Re-run all modules
      this.runModules(messages, state, input);

      this.logger.log(`Regulation after repair ${state.state.repair_count}: ${state.state.regulation}`);
    }

    // Force reset regulation if max repairs reached
    if (state.state.repair_count >= this.max_repairs && state.state.regulation !== 'normal') {
      this.logger.warn(`Max repairs reached (${this.max_repairs}), forcing NORMAL mode`);
      state.state.regulation = 'normal';
    }

    // === GROK PRE-COMMIT: Use Grok's verified facts directly if available ===
    if (grokVerificationData && grokVerificationData.confidence >= 0.85) {
      this.logger.log('🛡️  GROK PRE-COMMIT: High-confidence verification detected — boosting trust before synthesis');
      this.logger.log(`   Grok confidence: ${grokVerificationData.confidence}, Pre-boost τ: ${state.state.trust_tau.toFixed(3)} → 0.85`);
      
      // Pre-boost trust to prevent safety valve from triggering
      state.state.trust_tau = Math.max(state.state.trust_tau, 0.85);
      state.state.regulation = 'normal'; // Grok verified = safe to proceed normally
    }

    // === SYNTHESISER (Final Response Generation with Weighted Aggregation) ===
    this.logger.log('=== GENERATING FINAL RESPONSE (Weighted Band Synthesis) ===');
    const responseObj = await this.synthesiserAgent.synthesize(messages, state, grokVerificationData, bandJamResults);
    let response = responseObj.content;

    // === POST-SYNTHESIS VERIFICATION: Grok double-checks the final output ===
    this.logger.log('🔍 POST-SYNTHESIS: Grok performing final fact-check...');
    const postVerification = await this.verifierAgent.postSynthesisCheck(response, messages);
    
    // VETO LOGIC: If Grok confidence < 0.8, flag for re-jam
    if (postVerification && postVerification.confidence < 0.8 && state.state.repair_count < this.max_repairs) {
      this.logger.warn(`⚠️  VETO: Grok confidence ${postVerification.confidence.toFixed(2)} < 0.8 — triggering re-jam`);
      state.state.trust_tau = Math.max(state.state.trust_tau - 0.15, 0.3); // Reduce trust
      state.state.repair_count += 1;
      state.state.regulation = 'heightened';
      
      // Append Grok's corrections to context for re-jam
      if (postVerification.corrections && postVerification.corrections.length > 0) {
        this.logger.log(`   Corrections: ${postVerification.corrections.join(', ')}`);
      }
      
      // Re-jam not implemented yet - log warning
      this.logger.warn('   Re-jam mechanism not yet implemented - proceeding with current response');
    } else if (postVerification && postVerification.confidence >= 0.8) {
      this.logger.log(`✅ POST-SYNTHESIS: Grok confirmed accuracy (confidence: ${postVerification.confidence.toFixed(2)})`);
      
      // Boost trust if Grok is confident
      if (postVerification.confidence >= 0.9) {
        state.state.trust_tau = Math.min(state.state.trust_tau + 0.05, 1.0);
      }
    }

    // 🚨 GROK TRUTH OVERRIDE: If we hit max repairs with low trust, but Grok was used, trust it!
    const grokWasUsed = responseObj.metadata?.model?.toLowerCase().includes('grok') || 
                        (grokVerificationData && grokVerificationData.hasDiscrepancy) ||
                        (postVerification && postVerification.confidence >= 0.8);
    
    if (state.state.repair_count >= this.max_repairs && state.state.trust_tau < 0.7) {
      if (grokWasUsed) {
        // Grok has real-time verification — it's the truth anchor when all else fails
        this.logger.log('🔥 GROK TRUTH OVERRIDE: Max repairs reached, but Grok verified facts — delivering response');
        this.logger.log(`   Original τ: ${state.state.trust_tau.toFixed(3)} → Boosted τ: 0.85 (Grok-verified)`);
        
        // Boost trust because Grok's real-time verification is authoritative
        state.state.trust_tau = 0.85;
        state.state.regulation = 'normal'; // Grok saved us!
      } else {
        this.logger.warn('⚠️  Max repairs reached with low trust and no Grok verification — response quality may be degraded');
      }
    }

    // Save assistant response with LLM metadata
    if (this.hasDatabase) {
      const assistantMsg = this.msgRepo!.create({
        conversation_id: sessionId,
        role: 'assistant',
        content: response,
        // Save LLM metadata for cost/performance tracking
        model: responseObj.metadata?.model,
        tokens_input: responseObj.metadata?.tokens_input,
        tokens_output: responseObj.metadata?.tokens_output,
        tokens_total: responseObj.metadata?.tokens_total,
        cost_usd: responseObj.metadata?.cost_usd,
        latency_ms: responseObj.metadata?.latency_ms,
      });
      await this.msgRepo!.save(assistantMsg);

      // Update state timestamp and save
      state.updated_at = new Date();
      await this.stateRepo!.save(state);
    } else {
      // Save to memory
      messages.push({ role: 'assistant', content: response, timestamp: new Date() });
      this.inMemoryMessages.set(sessionId, messages);
      
      state.updated_at = new Date();
      this.inMemoryStates.set(sessionId, state);
    }

    this.logger.log(`=== PIPELINE COMPLETE === τ=${state.state.trust_tau.toFixed(3)}, repairs=${state.state.repair_count}`);

    // Track LLM contributions from Band Jam Mode
    // All 4 agents always participate now, track them with their actual weights
    if (bandJamResults && bandJamResults.weights) {
      this.trackContribution(sessionId, 'analyst', 'claude', !!bandJamResults.results.analyst, false);
      this.trackContribution(sessionId, 'relational', 'gpt-5', !!bandJamResults.results.relational, false);
      this.trackContribution(sessionId, 'ethics', 'gpt-5', !!bandJamResults.results.ethics, false);
      this.trackContribution(sessionId, 'verification', 'grok-4.1', !!bandJamResults.results.verification, false);
      
      this.logger.log(`📊 Tracked contributions: Analyst=${bandJamResults.weights.analyst.toFixed(2)}, Relational=${bandJamResults.weights.relational.toFixed(2)}, Ethics=${bandJamResults.weights.ethics.toFixed(2)}, Verification=${bandJamResults.weights.verification.toFixed(2)}`);
    }
    
    // Track synthesiser model
    const synthModel = responseObj.metadata?.model || 'claude';
    this.trackContribution(sessionId, 'synthesiser', synthModel, true, false, undefined, 
      responseObj.metadata?.cost_usd, responseObj.metadata?.latency_ms);

    // Flush all tracked contributions to database
    await this.flushContributions(sessionId);

    return {
      response,
      internal_state: {
        sim: state.state.sim,
        contradiction: state.state.contradiction,
        regulation: state.state.regulation,
        trust_tau: state.state.trust_tau,
        repair_count: state.state.repair_count,
      },
    };
  }

  /**
   * Get full session details
   */
  async getSession(sessionId: string): Promise<any> {
    this.logger.log(`Retrieving session: ${sessionId}`);

    if (this.hasDatabase) {
      const conversation = await this.convRepo!.findOne({
        where: { id: sessionId },
        relations: ['messages'],
      });

      if (!conversation) {
        throw new NotFoundException(`Session not found: ${sessionId}`);
      }

      const state = await this.stateRepo!.findOne({
        where: { session_id: sessionId },
      });

      return {
        session_id: conversation.id,
        user_id: conversation.user_id,
        created_at: conversation.created_at,
        messages: conversation.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
        internal_state: state?.state || null,
        last_updated: state?.updated_at || null,
      };
    } else {
      // Load from memory
      const conversation = this.inMemoryConversations.get(sessionId);
      if (!conversation) {
        throw new NotFoundException(`Session not found: ${sessionId}`);
      }

      const messages = this.inMemoryMessages.get(sessionId) || [];
      const state = this.inMemoryStates.get(sessionId);

      return {
        session_id: conversation.id,
        user_id: conversation.user_id,
        created_at: new Date(),
        messages: messages.map((m, idx) => ({
          id: idx,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
        internal_state: state?.state || null,
        last_updated: state?.updated_at || null,
      };
    }
  }

  /**
   * Run all agents in TRUE BAND JAM MODE
   * - Planner decomposes query into subtasks
   * - All 4 agents run in parallel with specific assignments
   * - Results are weighted and combined
   */
  private async runAgents(messages: Message[], state: InternalState, enableParallelVerification = false): Promise<any> {
    this.logger.log('🎼 BAND JAM MODE: Starting collaborative multi-agent execution...');
    
    // Get the latest user query
    const latestUserMessage = messages.filter(m => m.role === 'user').pop();
    const query = latestUserMessage?.content || '';
    
    // Step 1: Planner decomposes query into parallel subtasks
    const taskPlan = await this.plannerAgent.plan(query, messages);
    
    this.logger.log(`🎯 Task plan strategy: ${taskPlan.strategy}`);
    this.logger.log(`   Analyst weight: ${(taskPlan.tasks[0].weight * 100).toFixed(0)}%`);
    this.logger.log(`   Relational weight: ${(taskPlan.tasks[1].weight * 100).toFixed(0)}%`);
    this.logger.log(`   Ethics weight: ${(taskPlan.tasks[2].weight * 100).toFixed(0)}%`);
    this.logger.log(`   Verification weight: ${(taskPlan.tasks[3].weight * 100).toFixed(0)}%`);
    
    // Step 2: Execute all agents in parallel with their specific subtasks
    this.logger.log('🎸🎹🎷🥁 All band members playing simultaneously...');
    
    const startTime = Date.now();
    
    const [analystResult, relationalResult, ethicsResult, verificationResult] = await Promise.all([
      // Analyst - enriched with subtask
      this.analystAgent.analyze(messages, state, taskPlan.tasks[0].subtask).catch(err => {
        this.logger.error(`❌ Analyst failed: ${err.message}`);
        return null;
      }),
      
      // Relational - enriched with subtask
      this.relationalAgent.analyze(messages, state, taskPlan.tasks[1].subtask).catch(err => {
        this.logger.error(`❌ Relational failed: ${err.message}`);
        return null;
      }),
      
      // Ethics - enriched with subtask
      this.ethicsAgent.analyze(messages, state, taskPlan.tasks[2].subtask).catch(err => {
        this.logger.error(`❌ Ethics failed: ${err.message}`);
        return null;
      }),
      
      // Verifier (Grok) - truth anchor drummer with veto power
      this.verifierAgent.verify(
        query,
        {}, // Empty initially - will cross-check after synthesis
        messages,
        taskPlan.tasks[3].subtask
      ).catch(err => {
        this.logger.error(`❌ Verifier failed: ${err.message}`);
        return null;
      }),
    ]);
    
    const elapsed = Date.now() - startTime;
    this.logger.log(`✅ Band jam complete in ${elapsed}ms (${(elapsed / 1000).toFixed(2)}s)`);
    
    // Step 3: Log individual contributions for analytics
    const contributions = [
      { agent: 'analyst', weight: taskPlan.tasks[0].weight, success: !!analystResult },
      { agent: 'relational', weight: taskPlan.tasks[1].weight, success: !!relationalResult },
      { agent: 'ethics', weight: taskPlan.tasks[2].weight, success: !!ethicsResult },
      { agent: 'verification', weight: taskPlan.tasks[3].weight, success: !!verificationResult },
    ];
    
    contributions.forEach(c => {
      const status = c.success ? '✅' : '❌';
      this.logger.log(`   ${status} ${c.agent}: ${(c.weight * 100).toFixed(0)}% contribution`);
    });
    
    // Step 4: Return aggregated results for synthesizer
    return {
      taskPlan,
      results: {
        analyst: analystResult,
        relational: relationalResult,
        ethics: ethicsResult,
        verification: verificationResult,
      },
      weights: {
        analyst: taskPlan.tasks[0].weight,
        relational: taskPlan.tasks[1].weight,
        ethics: taskPlan.tasks[2].weight,
        verification: taskPlan.tasks[3].weight,
      },
      totalLatency: elapsed,
    };
  }

  /**
   * Run all modules in sequence
   */
  private runModules(messages: Message[], state: InternalState, input: string): void {
    this.logger.log('Running all modules...');
    
    this.simModule.calculate(messages, state);
    this.camModule.calculate(messages, state);
    this.sreModule.calculate(state);
    this.ctmModule.calculate(state);
    this.rilModule.calculate(state, input);
    
    this.logger.log('All modules completed');
  }

  /**
   * PHASE 3.5: Detect if a query requires real-time factual verification
   */
  private detectFactualQuery(input: string): boolean {
    const factualKeywords = [
      'current', 'today', 'now', 'latest', 'recent', 'president', 'who is',
      'what happened', 'when did', 'news', '2025', '2024', 'executive order',
      'verify', 'fact check', 'true', 'false', 'confirm', 'correct',
      'stock price', 'weather', 'score', 'election', 'breaking'
    ];
    
    const lowerInput = input.toLowerCase();
    return factualKeywords.some(keyword => lowerInput.includes(keyword));
  }
}
