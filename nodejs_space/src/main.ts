
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global validation pipe - CRITICAL: forbidNonWhitelisted MUST be true to strip unknown query params
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true, // Strip unknown params like _cb (cache-busting) - DO NOT CHANGE TO FALSE
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
      'Phase 2: Full VCTT-AGI Engine with PostgreSQL, persistent memory, session history, ' +
      'cross-session analytics, and trust metric visualization. Includes 4 Agents (Analyst, Relational, ' +
      'Ethics, Synthesiser) and 5 Modules (SIM, CAM, SRE, CTM, RIL). Features repair loop with max 3 ' +
      'iterations and trust metric calculation.'
    )
    .setVersion('2.0.0')
    .addTag('session', 'Session management and conversation endpoints')
    .addTag('health', 'Service health monitoring')
    .addTag('analytics', 'Session history, analytics, and cross-session patterns')
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
  console.log('  🧠 VCTT-AGI COHERENCE KERNEL - PHASE 3');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  🚀 Service running on: http://${host}:${port}`);
  console.log(`  📚 Swagger UI: http://${host}:${port}/api`);
  console.log(`  ❤️  Health Check: http://${host}:${port}/health`);
  console.log(`  🗄️  Database: ${databaseStatus}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Agents: Analyst | Relational | Ethics | Synthesiser');
  console.log('  Modules: SIM | CAM | SRE | CTM | RIL');
  console.log('  Max Repairs: 3 | Trust Formula: τ = 1 - (0.4T + 0.3U + 0.3C)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`✅ Server successfully started and listening on ${host}:${port}`);
}

bootstrap().catch((error) => {
  console.error('❌ Fatal error during bootstrap:', error);
  process.exit(1);
});
