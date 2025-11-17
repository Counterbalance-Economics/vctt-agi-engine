
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VCTTEngineService } from './services/vctt-engine.service';
import { SessionController } from './controllers/session.controller';
import { HealthController } from './controllers/health.controller';
import { AnalystAgent } from './agents/analyst.agent';
import { RelationalAgent } from './agents/relational.agent';
import { EthicsAgent } from './agents/ethics.agent';
import { SynthesiserAgent } from './agents/synthesiser.agent';
import { SIMModule } from './modules/sim.module';
import { CAMModule } from './modules/cam.module';
import { SREModule } from './modules/sre.module';
import { CTMModule } from './modules/ctm.module';
import { RILModule } from './modules/ril.module';

@Module({
  imports: [
    // Configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // TypeORM disabled for now - using in-memory storage
    // Will be enabled when database is configured
  ],
  
  providers: [
    // Core service
    VCTTEngineService,
    
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
  ],
})
export class AppModule {}
