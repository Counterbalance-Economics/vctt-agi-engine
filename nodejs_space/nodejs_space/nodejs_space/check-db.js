
const { PrismaClient } = require('@prisma/client');

async function checkDatabase() {
  const prisma = new PrismaClient();
  
  try {
    // Check if tables exist
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    console.log('\n📊 Existing tables:');
    tables.forEach(t => console.log(`  - ${t.table_name}`));
    
    // Check tool_invocations structure if it exists
    if (tables.some(t => t.table_name === 'tool_invocations')) {
      const columns = await prisma.$queryRaw`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'tool_invocations' 
        ORDER BY ordinal_position
      `;
      
      console.log('\n📋 tool_invocations columns:');
      columns.forEach(c => console.log(`  - ${c.column_name}: ${c.data_type}`));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
