
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔌 Connected to database');

    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../src/migrations/007_autonomous_execution.sql'),
      'utf8'
    );

    console.log('📦 Running Migration 007: Autonomous Execution System...');
    await client.query(migrationSQL);
    console.log('✅ Migration 007 completed successfully!');
    console.log('   - execution_queue table created');
    console.log('   - execution_logs table created');
    console.log('   - agent_pool table created');
    console.log('   - coach_execution_proposals table created');
    console.log('   - Indexes and triggers created');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

runMigration()
  .then(() => {
    console.log('🎉 Migration 007 complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration 007 failed:', error);
    process.exit(1);
  });
