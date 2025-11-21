
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { SessionController } from './controllers/session.controller';
import { HealthController } from './controllers/health.controller';
import { AnalyticsController } from './controllers/analytics.controller';
import { LLMCommitteeController } from './controllers/llm-committee.controller';
import { TruthMyceliumController } from './controllers/truth-mycelium.controller';
import { IdeController } from './controllers/ide.controller';
import { SafetyController } from './controllers/safety.controller';
import { MemoryController } from './controllers/memory.controller';
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
  ],
})
export class AppModule {}
