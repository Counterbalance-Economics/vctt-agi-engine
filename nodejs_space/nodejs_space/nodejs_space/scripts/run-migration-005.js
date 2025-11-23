
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🔄 Running DeepAgent Sessions migration...');
    
    // Create deepagent_sessions table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS deepagent_sessions (
        id SERIAL PRIMARY KEY,
        session_uuid VARCHAR(100) UNIQUE NOT NULL,
        goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
        subtask_id INTEGER REFERENCES goal_subtasks(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'created',
        context JSONB NOT NULL,
        result JSONB,
        initiated_by VARCHAR(100) NOT NULL,
        deep_agent_url TEXT,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB DEFAULT '{}'::jsonb,
        CONSTRAINT valid_session_status CHECK (status IN ('created', 'in_progress', 'completed', 'failed', 'cancelled'))
      )
    `);
    console.log('✅ Created deepagent_sessions table');
    
    // Create deepagent_session_activities table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS deepagent_session_activities (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES deepagent_sessions(id) ON DELETE CASCADE,
        activity_type VARCHAR(100) NOT NULL,
        description TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Created deepagent_session_activities table');
    
    // Create indexes
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_deepagent_sessions_goal ON deepagent_sessions(goal_id)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_deepagent_sessions_subtask ON deepagent_sessions(subtask_id)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_deepagent_sessions_status ON deepagent_sessions(status)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_deepagent_sessions_uuid ON deepagent_sessions(session_uuid)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_deepagent_session_activities_session ON deepagent_session_activities(session_id)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_deepagent_session_activities_timestamp ON deepagent_session_activities(timestamp DESC)`);
    console.log('✅ Created indexes');
    
    // Create trigger function
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION update_deepagent_sessions_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    console.log('✅ Created trigger function');
    
    // Create trigger
    await prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS deepagent_sessions_updated_at_trigger ON deepagent_sessions
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER deepagent_sessions_updated_at_trigger
      BEFORE UPDATE ON deepagent_sessions
      FOR EACH ROW
      EXECUTE FUNCTION update_deepagent_sessions_timestamp()
    `);
    console.log('✅ Created trigger');
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
