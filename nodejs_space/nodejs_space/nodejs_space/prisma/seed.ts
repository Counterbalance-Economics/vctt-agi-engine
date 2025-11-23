
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding VCTT-AGI Memory System database...');

  // Create a default test consent record (for development/testing)
  const testConsent = await prisma.memory_consent.upsert({
    where: { user_id: 'test_user_001' },
    update: {},
    create: {
      user_id: 'test_user_001',
      consent_given: true,
      consent_date: new Date(),
      consent_version: '1.0.0',
      preferences: {
        allow_conversation_memory: true,
        allow_learned_facts: true,
        allow_preferences: true,
        retention_days: 90,
      },
    },
  });

  console.log('✅ Created test consent:', testConsent);

  // Log the seed operation
  await prisma.memory_audit.create({
    data: {
      user_id: 'system',
      operation: 'SEED',
      reason: 'Database seeding completed',
      vctt_verification: true,
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    },
  });

  console.log('🎉 Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
