
#!/bin/bash
set -e

echo "🗄️  Setting up Prisma baseline for production database..."

cd /home/ubuntu/vctt_agi_engine/nodejs_space

# Mark baseline as applied (this tells Prisma the starting point)
echo "📍 Marking baseline migration as applied..."
npx prisma migrate resolve --applied 0_baseline

# Now deploy all migrations
echo "🚀 Deploying all migrations..."
npx prisma migrate deploy

echo "✅ Baseline setup complete! All migrations deployed."
echo ""
echo "Next steps:"
echo "1. Commit and push these changes to GitHub"
echo "2. Deploy to Render (migrations will now work automatically)"
