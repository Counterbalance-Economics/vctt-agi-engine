// src/main.ts — FINAL PRODUCTION VERSION (CORS + NestJS v11 + Safety + Swagger)
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { SafetyStewardAgent } from './agents/safety-steward.agent';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // FULL CORS FIX — explicit Vercel origins + localhost
  app.enableCors({
    origin: [
      /^https:\/\/vcttagi-.*\.vercel\.app$/,
      /^https:\/\/vctt-agi-.*\.vercel\.app$/,
      'https://vcttagiui.vercel.app',
      'https://vcttagi.vercel.app',
      'https://vctt-agi-ui.vercel.app',
      'http://localhost:3000',
      'http://localhost:5173',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Authorization',
  });

  // Body size limits
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('VCTT-AGI Backend API')
    .setDescription('Tier-5 Self-Improving AGI Backend')
    .setVersion('1.0')
    .addTag('safety')
    .addTag('goals')
    .addTag('scheduler')
    .addTag('coach')
    .addTag('skills')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  // SafetySteward boot
  const safety = app.get(SafetyStewardAgent);
  console.log('SafetySteward Loaded — Mode:', safety.getMode());

  // Enhanced Startup Banner with Instance Identity
  const platform = process.env.DEPLOYMENT_PLATFORM || 'unknown';
  const role = process.env.DEPLOYMENT_ROLE || 'unknown';
  const instanceName = process.env.INSTANCE_NAME || 'unknown-instance';
  const frontendUrl = process.env.CONNECTED_FRONTEND || 'unknown';
  
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log(`║  VCTT-AGI Engine (MIN) - ${role.toUpperCase().padEnd(28)} BACKEND  ║`);
  console.log('╠════════════════════════════════════════════════════════════════╣');
  console.log(`║  Instance:  ${instanceName.padEnd(49)} ║`);
  console.log(`║  Platform:  ${platform.padEnd(49)} ║`);
  console.log(`║  Role:      ${role.padEnd(49)} ║`);
  console.log(`║  Frontend:  ${frontendUrl.substring(0, 49).padEnd(49)} ║`);
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('\n');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 VCTT-AGI Backend LIVE on port ${port}`);
}

bootstrap();