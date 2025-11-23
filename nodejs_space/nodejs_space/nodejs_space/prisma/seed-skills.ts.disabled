
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedSkills() {
  console.log('🌱 Seeding Skill Library...');

  const skills = [
    {
      name: 'DEBUG_TYPESCRIPT_ERROR',
      description: 'Systematic approach to debugging TypeScript compilation errors',
      category: 'CODE_DEBUGGING',
      tags: ['typescript', 'debugging', 'compilation', 'error-fixing'],
      inputSchema: {
        errorMessage: 'string',
        filePath: 'string',
        lineNumber: 'number',
      },
      pattern: {
        steps: [
          'Read the error message carefully and identify the error type',
          'Locate the file and line number where the error occurs',
          'Check for common issues: missing imports, type mismatches, syntax errors',
          'Verify TypeScript configuration (tsconfig.json)',
          'Use IDE type hints to identify the exact issue',
          'Apply the fix and verify it compiles',
          'Run tests to ensure no regressions',
        ],
      },
      expectedOutcome: {
        compilationSuccess: true,
        noRegressions: true,
      },
      successRate: 85,
      usageCount: 12,
    },
    {
      name: 'CREATE_REST_API_ENDPOINT',
      description: 'Standard pattern for creating a new REST API endpoint in NestJS',
      category: 'API_DEVELOPMENT',
      tags: ['nestjs', 'api', 'rest', 'endpoint', 'controller'],
      inputSchema: {
        endpointName: 'string',
        httpMethod: 'string',
        requestDto: 'object',
        responseDto: 'object',
      },
      pattern: {
        steps: [
          'Create DTO classes for request and response',
          'Add validation decorators to DTOs',
          'Create service method with business logic',
          'Create controller endpoint with proper decorators',
          'Add Swagger documentation with @ApiOperation, @ApiResponse',
          'Add error handling and logging',
          'Write unit tests',
          'Test endpoint with Postman/curl',
        ],
      },
      expectedOutcome: {
        endpointWorks: true,
        swaggerDocumented: true,
        testsCoverage: '>80%',
      },
      successRate: 90,
      usageCount: 25,
    },
    {
      name: 'FIX_DATABASE_MIGRATION',
      description: 'Resolve Prisma database migration conflicts and errors',
      category: 'DATABASE',
      tags: ['prisma', 'database', 'migration', 'schema'],
      inputSchema: {
        errorType: 'string',
        schemaChanges: 'array',
      },
      pattern: {
        steps: [
          'Review the Prisma schema changes',
          'Check existing migrations in prisma/migrations',
          'If migration failed, reset the dev database: npx prisma migrate reset',
          'Create a new migration: npx prisma migrate dev --name <name>',
          'Verify the migration was applied successfully',
          'Regenerate Prisma Client: npx prisma generate',
          'Test the application to ensure database queries work',
        ],
      },
      expectedOutcome: {
        migrationApplied: true,
        clientGenerated: true,
        queriesWork: true,
      },
      successRate: 75,
      usageCount: 8,
    },
    {
      name: 'IMPLEMENT_AUTHENTICATION',
      description: 'Add JWT-based authentication to a NestJS application',
      category: 'SECURITY',
      tags: ['authentication', 'jwt', 'security', 'nestjs', 'guards'],
      inputSchema: {
        userModel: 'object',
        jwtSecret: 'string',
      },
      pattern: {
        steps: [
          'Install required packages: @nestjs/jwt, @nestjs/passport, passport-jwt',
          'Create AuthModule, AuthService, AuthController',
          'Implement login endpoint that returns JWT token',
          'Create JWT strategy for passport',
          'Create JwtAuthGuard to protect routes',
          'Add @UseGuards(JwtAuthGuard) to protected endpoints',
          'Test authentication flow',
        ],
      },
      expectedOutcome: {
        loginWorks: true,
        protectedRoutesSecured: true,
        tokenValidation: true,
      },
      successRate: 80,
      usageCount: 6,
    },
    {
      name: 'OPTIMIZE_DATABASE_QUERY',
      description: 'Improve database query performance with Prisma',
      category: 'PERFORMANCE',
      tags: ['prisma', 'database', 'optimization', 'performance', 'indexing'],
      inputSchema: {
        slowQuery: 'string',
        tableName: 'string',
        queryTime: 'number',
      },
      pattern: {
        steps: [
          'Identify the slow query using Prisma query logs',
          'Analyze the query execution plan',
          'Add database indexes to frequently queried columns',
          'Use Prisma select to fetch only needed fields',
          'Consider using include sparingly to avoid N+1 queries',
          'Implement pagination for large result sets',
          'Use transactions for bulk operations',
          'Measure query performance improvement',
        ],
      },
      expectedOutcome: {
        queryTimeReduced: '>50%',
        indexesAdded: true,
        paginationImplemented: true,
      },
      successRate: 70,
      usageCount: 4,
    },
    {
      name: 'ADD_SWAGGER_DOCUMENTATION',
      description: 'Add comprehensive Swagger/OpenAPI documentation to API',
      category: 'DOCUMENTATION',
      tags: ['swagger', 'openapi', 'documentation', 'api', 'nestjs'],
      inputSchema: {
        controllerName: 'string',
        endpoints: 'array',
      },
      pattern: {
        steps: [
          'Add @ApiTags decorator to controller class',
          'Add @ApiOperation to each endpoint with summary and description',
          'Add @ApiResponse for different status codes',
          'Add @ApiProperty to all DTO properties',
          'Use @ApiQuery for query parameters',
          'Use @ApiParam for path parameters',
          'Configure SwaggerModule in main.ts',
          'Test documentation at /api-docs',
        ],
      },
      expectedOutcome: {
        allEndpointsDocumented: true,
        schemasComplete: true,
        examplesProvided: true,
      },
      successRate: 95,
      usageCount: 18,
    },
    {
      name: 'IMPLEMENT_CRON_JOB',
      description: 'Add scheduled background task using NestJS Schedule',
      category: 'AUTOMATION',
      tags: ['cron', 'scheduler', 'automation', 'background-job', 'nestjs'],
      inputSchema: {
        jobName: 'string',
        schedule: 'string',
        taskDescription: 'string',
      },
      pattern: {
        steps: [
          'Install @nestjs/schedule package',
          'Import ScheduleModule.forRoot() in AppModule',
          'Create a service for the scheduled task',
          'Add @Cron decorator with cron expression',
          'Implement the task logic',
          'Add error handling and logging',
          'Test the job manually before scheduling',
          'Monitor job execution in production',
        ],
      },
      expectedOutcome: {
        jobScheduled: true,
        errorHandling: true,
        loggingImplemented: true,
      },
      successRate: 88,
      usageCount: 7,
    },
    {
      name: 'HANDLE_FILE_UPLOAD',
      description: 'Implement file upload endpoint with validation',
      category: 'FILE_HANDLING',
      tags: ['file-upload', 'multer', 'validation', 'storage', 'nestjs'],
      inputSchema: {
        allowedTypes: 'array',
        maxSize: 'number',
        destination: 'string',
      },
      pattern: {
        steps: [
          'Install multer and @types/multer',
          'Configure MulterModule in app',
          'Add @UseInterceptors(FileInterceptor) to endpoint',
          'Validate file type and size',
          'Save file to disk or cloud storage',
          'Return file metadata in response',
          'Add error handling for invalid files',
          'Clean up temporary files if needed',
        ],
      },
      expectedOutcome: {
        filesUploaded: true,
        validationWorks: true,
        secureStorage: true,
      },
      successRate: 82,
      usageCount: 5,
    },
  ];

  for (const skill of skills) {
    await prisma.skills.upsert({
      where: { name: skill.name },
      update: skill,
      create: skill,
    });
    console.log(`✓ Seeded skill: ${skill.name}`);
  }

  console.log(`✅ Seeded ${skills.length} skills to the library`);
}

seedSkills()
  .catch((e) => {
    console.error('❌ Error seeding skills:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
