
#!/bin/bash
set -e

echo "🗄️  Running Prisma migrations..."
cd /home/ubuntu/vctt_agi_engine/nodejs_space
npx prisma generate
npx prisma migrate deploy

echo "✅ Migrations deployed successfully!"
