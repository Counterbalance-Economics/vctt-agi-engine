
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // Enable CORS - Allow ALL Vercel deployments and localhost
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Allow all Vercel apps (*.vercel.app)
      if (origin.includes('.vercel.app')) {
        callback(null, true);
        return;
      }
      
      // Allow localhost for development
      if (origin.includes('localhost')) {
        callback(null, true);
        return;
      }
      
      // Allow all origins for now (production-ready CORS can be tightened later)
      callback(null, true);
      console.log(`✅ CORS: Allowed request from: ${origin}`);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Authorization, X-Requested-With, Accept',
    exposedHeaders: 'X-Total-Count',
    maxAge: 3600, // Cache preflight for 1 hour
  });

  // Global validation pipe - whitelist strips unknown props, forbidNonWhitelisted=false allows them silently
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // Allow unknown params like _cb (cache-busting) to be stripped silently
      transform: true,
      transformOptions: {
        enableImplicitConversion: true, // Auto-convert string "50" → number 50
      },
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('VCTT-AGI Coherence Kernel')
    .setDescription(
      'Phase 3.5: Full VCTT-AGI Engine with PostgreSQL, persistent memory, session history, ' +
      'cross-session analytics, WebSocket streaming, trust metric visualization, and advanced IDE backend services. ' +
      'Includes 4 Agents (Analyst, Relational, Ethics, Synthesiser), Grok-4.1 Verifier, ' +
      'and 5 Modules (SIM, CAM, SRE, CTM, RIL). Features repair loop with max 3 ' +
      'iterations and trust metric calculation.\n\n' +
      '🌊 **WebSocket Streaming**: Connect to `ws://host:port/stream` for real-time token-by-token responses.\n' +
      'Events: `stream_request`, `stream_start`, `stream_chunk`, `stream_complete`, `stream_error`\n\n' +
      '🎨 **IDE Backend APIs**: Complete file management, code analysis, testing, and deployment services.\n' +
      'Endpoints: `/api/ide/*` - File tree, operations, code editing, test runner, analysis, deployment'
    )
    .setVersion('4.0.0-alpha')
    .addTag('session', 'Session management and conversation endpoints')
    .addTag('health', 'Service health monitoring')
    .addTag('analytics', 'Session history, analytics, and cross-session patterns')
    .addTag('streaming', 'WebSocket streaming for real-time LLM responses')
    .addTag('IDE Operations', 'Advanced IDE backend services for file management and code operations')
    .addTag('Safety & Admin', '🛡️ AGI safety controls, kill switch, mode management, and audit logs (ADMIN ONLY)')
    .addTag('Memory & Consent', '💾 Persistent memory system with user consent, GDPR compliance, and semantic search')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  // Setup Swagger at both /api and /api-docs
  const swaggerOptions = {
    customSiteTitle: 'VCTT-AGI API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
  };
  
  SwaggerModule.setup('api', app, document, swaggerOptions);
  SwaggerModule.setup('api-docs', app, document, swaggerOptions);

  const port = process.env.PORT || 8000;
  const host = '0.0.0.0';
  
  // Start listening BEFORE any console logs
  await app.listen(port, host);
  
  const databaseStatus = process.env.DATABASE_URL ? '✅ Connected' : '⚠️  Disabled (no DATABASE_URL)';
  
  // Log server startup
  const agiMode = process.env.AGI_MODE_ENABLED === 'true' ? '🟢 ENABLED' : '🔴 DISABLED';
  const autonomousMode = process.env.AUTONOMOUS_MODE_ENABLED === 'true' ? '🟢 ENABLED' : '🔴 DISABLED';
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🧠 VCTT-AGI COHERENCE KERNEL - PHASE 4 (Tier 4 AGI)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  🚀 Service running on: http://${host}:${port}`);
  console.log(`  📚 Swagger UI: http://${host}:${port}/api`);
  console.log(`  ❤️  Health Check: http://${host}:${port}/health`);
  console.log(`  🌊 WebSocket Streaming: ws://${host}:${port}/stream`);
  console.log(`  🎨 IDE APIs: http://${host}:${port}/api/ide/*`);
  console.log(`  🛡️  Safety APIs: http://${host}:${port}/api/safety/*`);
  console.log(`  🗄️  Database: ${databaseStatus}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🤖 Agents: Analyst | Relational | Ethics | Synthesiser | Verifier | SafetySteward');
  console.log('  📦 Modules: SIM | CAM | SRE | CTM | RIL');
  console.log('  🛡️  AGI Safety: Charter | Kill Switch | Mode Gating | Regulation Guard');
  console.log(`  🎛️  AGI Mode: ${agiMode} | Autonomous Mode: ${autonomousMode}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`✅ Server successfully started and listening on ${host}:${port}`);
}

bootstrap().catch((error) => {
  console.error('❌ Fatal error during bootstrap:', error);
  process.exit(1);
});
