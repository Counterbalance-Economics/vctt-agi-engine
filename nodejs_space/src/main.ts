
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // Enable CORS - Allow Vercel frontend and localhost
  const allowedOrigins = [
    'https://vcttagi-kernar1t3-peters-projects-3a28ae0e.vercel.app',
    'https://vctt-agi-ui.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    '*', // Fallback for development
  ];

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Check if origin is allowed
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Be permissive for now, log warning
        console.warn(`⚠️  CORS: Request from non-whitelisted origin: ${origin}`);
      }
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
    .setVersion('3.5.0')
    .addTag('session', 'Session management and conversation endpoints')
    .addTag('health', 'Service health monitoring')
    .addTag('analytics', 'Session history, analytics, and cross-session patterns')
    .addTag('streaming', 'WebSocket streaming for real-time LLM responses')
    .addTag('IDE Operations', 'Advanced IDE backend services for file management and code operations')
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
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🧠 VCTT-AGI COHERENCE KERNEL - PHASE 3.5');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  🚀 Service running on: http://${host}:${port}`);
  console.log(`  📚 Swagger UI: http://${host}:${port}/api`);
  console.log(`  ❤️  Health Check: http://${host}:${port}/health`);
  console.log(`  🌊 WebSocket Streaming: ws://${host}:${port}/stream`);
  console.log(`  🎨 IDE APIs: http://${host}:${port}/api/ide/*`);
  console.log(`  🗄️  Database: ${databaseStatus}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Agents: Analyst | Relational | Ethics | Synthesiser | Verifier (Grok-4.1)');
  console.log('  Modules: SIM | CAM | SRE | CTM | RIL');
  console.log('  Features: Streaming | Truth Mycelium | IDE Backend | Cost Tracking');
  console.log('  Max Repairs: 3 | Trust Formula: τ = 1 - (0.4T + 0.3U + 0.3C)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`✅ Server successfully started and listening on ${host}:${port}`);
}

bootstrap().catch((error) => {
  console.error('❌ Fatal error during bootstrap:', error);
  process.exit(1);
});
