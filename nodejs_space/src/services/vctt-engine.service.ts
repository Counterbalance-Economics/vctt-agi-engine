
import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { InternalState, StateData } from '../entities/internal-state.entity';
import { AnalystAgent } from '../agents/analyst.agent';
import { RelationalAgent } from '../agents/relational.agent';
import { EthicsAgent } from '../agents/ethics.agent';
import { SynthesiserAgent } from '../agents/synthesiser.agent';
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

  constructor(
    @Optional() @InjectRepository(Conversation) private convRepo: Repository<Conversation> | null,
    @Optional() @InjectRepository(Message) private msgRepo: Repository<Message> | null,
    @Optional() @InjectRepository(InternalState) private stateRepo: Repository<InternalState> | null,
    private analystAgent: AnalystAgent,
    private relationalAgent: RelationalAgent,
    private ethicsAgent: EthicsAgent,
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

    // === RUN AGENTS (Initial Pass) ===
    await this.runAgents(messages, state);

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

    // === SYNTHESISER (Final Response Generation) ===
    this.logger.log('=== GENERATING FINAL RESPONSE ===');
    const responseObj = await this.synthesiserAgent.synthesize(messages, state);
    const response = responseObj.content;

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
   * Run all agents in sequence
   */
  private async runAgents(messages: Message[], state: InternalState): Promise<void> {
    this.logger.log('Running all agents...');
    
    await this.analystAgent.analyze(messages, state);
    await this.relationalAgent.analyze(messages, state);
    await this.ethicsAgent.analyze(messages, state);
    
    this.logger.log('All agents completed');
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
}
