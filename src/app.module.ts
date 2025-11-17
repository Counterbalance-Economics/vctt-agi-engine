
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';
import { Message } from './entities/message.entity';
import { InternalState } from './entities/internal-state.entity';
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
    
    // TypeORM configuration - conditional (only if DATABASE_URL exists)
    ...(process.env.DATABASE_URL ? [
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          const databaseUrl = configService.get<string>('DATABASE_URL');
          
          if (databaseUrl) {
            // Parse DATABASE_URL for hosted database
            const url = new URL(databaseUrl);
            return {
              type: 'postgres' as const,
              host: url.hostname,
              port: parseInt(url.port) || 5432,
              username: url.username,
              password: url.password,
              database: url.pathname.slice(1),
              entities: [Conversation, Message, InternalState],
              synchronize: true, // Auto-create tables (for Phase 1 simplicity)
              logging: configService.get<string>('NODE_ENV') === 'development',
              ssl: { rejectUnauthorized: false }, // For hosted databases
            };
          }
          
          // Fall back to individual env vars
          return {
            type: 'postgres' as const,
            host: configService.get<string>('DATABASE_HOST', 'postgres'),
            port: configService.get<number>('DATABASE_PORT', 5432),
            username: configService.get<string>('DATABASE_USER', 'vctt'),
            password: configService.get<string>('DATABASE_PASSWORD', 'secret'),
            database: configService.get<string>('DATABASE_NAME', 'vctt_agi'),
            entities: [Conversation, Message, InternalState],
            synchronize: true, // Auto-create tables (for Phase 1 simplicity)
            logging: configService.get<string>('NODE_ENV') === 'development',
          };
        },
      })
    ] : []),
    
    // Feature repositories - conditional (only if DATABASE_URL exists)
    ...(process.env.DATABASE_URL ? [
      TypeOrmModule.forFeature([Conversation, Message, InternalState])
    ] : []),
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
