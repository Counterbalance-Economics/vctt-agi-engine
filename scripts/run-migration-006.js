
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🚀 Running Migration 006: Session Activities (Phase 2 Auto-Sync)...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../src/migrations/006_session_activities.sql'),
      'utf8'
    );
    
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');
    
    console.log('✅ Migration 006 completed successfully!');
    console.log('📊 New tables created:');
    console.log('   - session_activities (activity log)');
    console.log('   - session_progress (progress tracking)');
    console.log('   - Added completion tracking columns to deepagent_sessions');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 006 failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
