
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER } from '@nestjs/core';
import { VCTTEngineService } from './services/vctt-engine.service';
import { AnalyticsService } from './services/analytics.service';
import { LLMService } from './services/llm.service';
import { LLMCascadeService } from './services/llm-cascade.service';
import { LLMCommitteeService } from './services/llm-committee.service';
import { LLMCacheService } from './services/llm-cache.service';
import { TruthMyceliumService } from './services/truth-mycelium.service';
import { DeepAgentService } from './services/deepagent.service';
import { IdeService } from './services/ide.service';
import { MemoryService } from './services/memory.service';
import { ConsentManagerService } from './services/consent-manager.service';
import { EmbeddingsService} from './services/embeddings.service';
import { PrismaService } from './services/prisma.service';
import { EntityExtractionService } from './services/entity-extraction.service';
import { KnowledgeGraphService } from './services/knowledge-graph.service';
import { ConceptHierarchyService } from './services/concept-hierarchy.service';
import { GoalService } from './services/goal.service';
import { StateInjectionService } from './services/state-injection.service';
import { SchedulerService } from './services/scheduler.service';
import { SystemIntegrityService } from './services/system-integrity.service';
import { AgentOrchestratorService } from './services/agent-orchestrator.service';
import { ToolsService } from './tools/tools.service';
import { EvaluationService } from './evaluation/evaluation.service';
import { SkillsService } from './skills/skills.service';
import { CoachService } from './coach/coach.service';
import { DeepAgentSessionService } from './services/deepagent-session.service';
import { SessionActivityService } from './services/session-activity.service';
import { SessionController } from './controllers/session.controller';
import { SessionActivityController } from './controllers/session-activity.controller';
import { HealthController } from './controllers/health.controller';
import { AnalyticsController } from './controllers/analytics.controller';
import { LLMCommitteeController } from './controllers/llm-committee.controller';
import { TruthMyceliumController } from './controllers/truth-mycelium.controller';
import { IdeController } from './controllers/ide.controller';
import { SafetyController } from './controllers/safety.controller';
import { MemoryController } from './controllers/memory.controller';
import { KnowledgeController } from './controllers/knowledge.controller';
import { GoalController } from './controllers/goal.controller';
import { ExecutionController } from './controllers/execution.controller';
import { SchedulerController } from './controllers/scheduler.controller';
import { ToolsController } from './tools/tools.controller';
import { EvaluationController } from './evaluation/evaluation.controller';
import { SkillsController } from './skills/skills.controller';
import { CoachController } from './coach/coach.controller';
import { DeepAgentController } from './controllers/deepagent.controller';
import { DeepAgentSessionController } from './controllers/deepagent-session.controller';
import { PlannerAgent } from './agents/planner.agent';
import { AnalystAgent } from './agents/analyst.agent';
import { RelationalAgent } from './agents/relational.agent';
import { EthicsAgent } from './agents/ethics.agent';
import { SynthesiserAgent } from './agents/synthesiser.agent';
import { VerifierAgent } from './agents/verifier.agent';
import { SafetyStewardAgent } from './agents/safety-steward.agent';
import { SIMModule } from './modules/sim.module';
import { CAMModule } from './modules/cam.module';
import { SREModule } from './modules/sre.module';
import { CTMModule } from './modules/ctm.module';
import { RILModule } from './modules/ril.module';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { CostLimitGuard } from './guards/cost-limit.guard';
import { RegulationGuard } from './guards/regulation.guard';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { InternalState } from './entities/internal-state.entity';
import { LLMContribution } from './entities/llm-contribution.entity';
import { StreamingGateway } from './gateways/streaming.gateway';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

@Module({
  imports: [
    // Configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // Task Scheduler module (for autonomous task execution)
    ScheduleModule.forRoot(),
    
    // TypeORM PostgreSQL Configuration - Only if DATABASE_URL is set
    ...(process.env.DATABASE_URL
      ? [
          TypeOrmModule.forRoot({
            type: 'postgres',
            url: process.env.DATABASE_URL,
            entities: [Conversation, Message, InternalState, LLMContribution],
            synchronize: true, // Auto-create tables (disable in production)
            logging: process.env.NODE_ENV === 'development',
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
          }),
          TypeOrmModule.forFeature([Conversation, Message, InternalState, LLMContribution]),
        ]
      : []),
  ],
  
  providers: [
    // Global Exception Filter - Catches all errors and prevents 502s
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    
    // Core services
    VCTTEngineService,
    AnalyticsService,
    LLMService,
    LLMCascadeService,
    LLMCommitteeService,
    LLMCacheService, // Phase 3.5+ Performance Optimization
    TruthMyceliumService,
    DeepAgentService, // Autonomous engineering co-pilot
    IdeService, // IDE operations (Phase 3.5)
    PrismaService, // Prisma database client (Stage 1)
    MemoryService, // Memory persistence (Stage 1)
    ConsentManagerService, // Consent management (Stage 1)
    EmbeddingsService, // Embeddings for semantic search (Stage 1)
    EntityExtractionService, // Entity extraction (Stage 2)
    KnowledgeGraphService, // Knowledge graph operations (Stage 2)
    ConceptHierarchyService, // Concept hierarchies (Stage 2)
    GoalService, // Goal system (Stage 3)
    StateInjectionService, // State awareness (Stage 3)
    AgentOrchestratorService, // Autonomous goal execution (Stage 3)
    SchedulerService, // Autonomous task scheduling (Stage 4)
    SystemIntegrityService, // MIN self-diagnostic & daily review (Stage 5)
    ToolsService, // Tool orchestration (Stage 4)
    EvaluationService, // Self-evaluation & coach (Stage 4/5)
    SkillsService, // Skill library (Stage 4/5)
    CoachService, // Nightly self-improvement loop (Stage 5)
    DeepAgentSessionService, // DeepAgent Sessions (Phase 1 Manual Bridge)
    SessionActivityService, // Session Activity Tracking (Phase 2 Auto-Sync)
    
    // Agents
    PlannerAgent,
    AnalystAgent,
    RelationalAgent,
    EthicsAgent,
    SynthesiserAgent,
    VerifierAgent,
    SafetyStewardAgent,
    
    // Modules
    SIMModule,
    CAMModule,
    SREModule,
    CTMModule,
    RILModule,
    
    // Guards (for @UseGuards decorator)
    RateLimitGuard,
    CostLimitGuard,
    RegulationGuard,
    
    // WebSocket Gateway
    StreamingGateway,
  ],
  
  controllers: [
    SessionController,
    HealthController,
    AnalyticsController,
    LLMCommitteeController,
    TruthMyceliumController,
    IdeController,
    SafetyController,
    MemoryController, // Memory & Consent APIs (Stage 1)
    KnowledgeController, // Knowledge Graph APIs (Stage 2)
    GoalController, // Goal System APIs (Stage 3)
    ExecutionController, // Autonomous Goal Execution (Stage 3)
    SchedulerController, // Autonomous Task Scheduling (Stage 4)
    ToolsController, // Tool Orchestration (Stage 4)
    EvaluationController, // Self-Evaluation & Coach (Stage 4/5)
    SkillsController, // Skill Library (Stage 4/5)
    CoachController, // Nightly Coach Analysis (Stage 5)
    DeepAgentController, // DeepAgent Terminal (IDE)
    DeepAgentSessionController, // DeepAgent Sessions API (Phase 1 Manual Bridge)
    SessionActivityController, // Session Activity Tracking API (Phase 2 Auto-Sync)
  ],
})
export class AppModule {}
