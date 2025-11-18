
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VCTTEngineService } from './services/vctt-engine.service';
import { AnalyticsService } from './services/analytics.service';
import { LLMService } from './services/llm.service';
import { SessionController } from './controllers/session.controller';
import { HealthController } from './controllers/health.controller';
import { AnalyticsController } from './controllers/analytics.controller';
import { AnalystAgent } from './agents/analyst.agent';
import { RelationalAgent } from './agents/relational.agent';
import { EthicsAgent } from './agents/ethics.agent';
import { SynthesiserAgent } from './agents/synthesiser.agent';
import { SIMModule } from './modules/sim.module';
import { CAMModule } from './modules/cam.module';
import { SREModule } from './modules/sre.module';
import { CTMModule } from './modules/ctm.module';
import { RILModule } from './modules/ril.module';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { InternalState } from './entities/internal-state.entity';

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
            entities: [Conversation, Message, InternalState],
            synchronize: true, // Auto-create tables (disable in production)
            logging: process.env.NODE_ENV === 'development',
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
          }),
          TypeOrmModule.forFeature([Conversation, Message, InternalState]),
        ]
      : []),
  ],
  
  providers: [
    // Core services
    VCTTEngineService,
    AnalyticsService,
    LLMService,
    
    // Agents
    AnalystAgent,
    RelationalAgent,
    EthicsAgent,
    SynthesiserAgent,
    
    // Modules
    SIMModule,
    CAMModule,
    SREModule,
    CTMModule,
    RILModule,
  ],
  
  controllers: [
    SessionController,
    HealthController,
    AnalyticsController,
  ],
})
export class AppModule {}
