
import { Controller, Post, Get, Logger, Body } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal } from '../entities/goal.entity';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';

@ApiTags('Database Migrations')
@Controller('api/migrations')
export class MigrationController {
  private readonly logger = new Logger(MigrationController.name);

  constructor(
    @InjectRepository(Goal)
    private goalRepository: Repository<Goal>,
  ) {}

  @Post('apply/goal-artifacts')
  @ApiOperation({ 
    summary: 'Apply goal_artifacts table migration',
    description: 'Creates the goal_artifacts table in production database'
  })
  @ApiResponse({ status: 200, description: 'Migration applied successfully' })
  @ApiResponse({ status: 500, description: 'Migration failed' })
  async applyGoalArtifactsMigration(): Promise<any> {
    this.logger.log('POST /api/migrations/apply/goal-artifacts - Applying migration...');

    const db = this.goalRepository.manager;

    try {
      // Check if table already exists
      const tableExists = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'goal_artifacts'
        );
      `);

      if (tableExists[0].exists) {
        return {
          success: true,
          message: 'goal_artifacts table already exists',
          alreadyExists: true,
        };
      }

      // Create the table
      await db.query(`
        CREATE TABLE IF NOT EXISTS goal_artifacts (
          id SERIAL PRIMARY KEY,
          goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
          artifact_type VARCHAR(50) NOT NULL,
          artifact_name VARCHAR(500) NOT NULL,
          artifact_description TEXT,
          artifact_path TEXT,
          artifact_data TEXT,
          file_size INTEGER,
          mime_type VARCHAR(100),
          metadata JSONB,
          created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(100) NOT NULL DEFAULT 'min'
        );
      `);

      // Create indexes
      await db.query(`CREATE INDEX IF NOT EXISTS idx_artifacts_goal ON goal_artifacts(goal_id);`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_artifacts_type ON goal_artifacts(artifact_type);`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_artifacts_created ON goal_artifacts(created_at);`);

      // Add table comment
      await db.query(`COMMENT ON TABLE goal_artifacts IS 'Stores completed builds, outputs, and deliverables from MIN executions';`);

      this.logger.log('✅ goal_artifacts table created successfully');

      return {
        success: true,
        message: 'goal_artifacts table created successfully',
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      this.logger.error(`❌ Migration failed: ${error.message}`, error.stack);
      return {
        success: false,
        message: error.message,
        error: error.stack,
      };
    }
  }

  @Get('status')
  @ApiOperation({ 
    summary: 'Check migration status',
    description: 'Check which tables exist in the database'
  })
  @ApiResponse({ status: 200, description: 'Migration status retrieved' })
  async getMigrationStatus(): Promise<any> {
    this.logger.log('GET /api/migrations/status');

    const db = this.goalRepository.manager;

    try {
      const tables = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `);

      const artifactsExists = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'goal_artifacts'
        );
      `);

      return {
        success: true,
        tables: tables.map((t: any) => t.table_name),
        artifactsTableExists: artifactsExists[0].exists,
      };

    } catch (error) {
      this.logger.error(`❌ Failed to get migration status: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}
