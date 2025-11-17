
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

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('VCTT-AGI Coherence Kernel')
    .setDescription(
      'Phase 1: Full VCTT-AGI Engine with 4 Agents (Analyst, Relational, Ethics, Synthesiser) ' +
      'and 5 Modules (SIM, CAM, SRE, CTM, RIL). Includes repair loop with max 3 iterations and trust metric calculation.'
    )
    .setVersion('1.0.0')
    .addTag('VCTT Session Management', 'Endpoints for managing conversation sessions')
    .addTag('Health Check', 'Service health monitoring')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    customSiteTitle: 'VCTT-AGI API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  const port = process.env.PORT || 8000;
  await app.listen(port, '0.0.0.0');

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🧠 VCTT-AGI COHERENCE KERNEL - PHASE 1');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  🚀 Service running on: http://localhost:${port}`);
  console.log(`  📚 Swagger UI: http://localhost:${port}/api`);
  console.log(`  ❤️  Health Check: http://localhost:${port}/health`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Agents: Analyst | Relational | Ethics | Synthesiser');
  console.log('  Modules: SIM | CAM | SRE | CTM | RIL');
  console.log('  Max Repairs: 3 | Trust Formula: τ = 1 - (0.4T + 0.3U + 0.3C)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
}

bootstrap();
