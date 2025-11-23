
#!/bin/bash

# Quick Deployment Script for VCTT-AGI Phase 2
# This script prepares the project for deployment to Render/Railway

set -e

echo "🚀 VCTT-AGI Phase 2 - Quick Deployment Preparation"
echo "=================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ] && [ -d "nodejs_space" ]; then
    cd nodejs_space
fi

if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in the correct directory"
    echo "Please run this script from /home/ubuntu/vctt_agi_engine or /home/ubuntu/vctt_agi_engine/nodejs_space"
    exit 1
fi

echo "✅ Directory check passed"
echo ""

# Run tests
echo "🧪 Running tests..."
yarn test:e2e
if [ $? -eq 0 ]; then
    echo "✅ All tests passed (12/12)"
else
    echo "❌ Tests failed - fix before deploying"
    exit 1
fi
echo ""

# Build the project
echo "🔨 Building project..."
yarn build
if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi
echo ""

# Check for required environment variables
echo "🔍 Checking environment setup..."
if [ -f ".env" ]; then
    echo "✅ .env file found"
    if grep -q "OPENAI_API_KEY" .env; then
        echo "✅ OPENAI_API_KEY configured"
    else
        echo "⚠️  Warning: OPENAI_API_KEY not found in .env"
    fi
else
    echo "⚠️  Warning: No .env file found (will use environment variables from hosting platform)"
fi
echo ""

# Git status
echo "📝 Git status..."
cd ..
git status --short
echo ""

echo "✅ Pre-deployment checks complete!"
echo ""
echo "=================================================="
echo "🚀 Ready for Deployment!"
echo "=================================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Push to GitHub (if not done):"
echo "   git push origin master --tags"
echo ""
echo "2. Deploy Backend to Render:"
echo "   - Go to https://dashboard.render.com"
echo "   - Click 'New +' → 'Web Service'"
echo "   - Connect GitHub repository"
echo "   - Root Directory: nodejs_space"
echo "   - Build Command: yarn install && yarn build"
echo "   - Start Command: yarn start:prod"
echo "   - Add PostgreSQL database"
echo "   - Set OPENAI_API_KEY environment variable"
echo ""
echo "3. Deploy UI to Vercel:"
echo "   cd /home/ubuntu/vctt_agi_ui"
echo "   # Update VITE_API_URL with your backend URL"
echo "   vercel --prod"
echo ""
echo "📚 Full instructions: DEPLOYMENT_STATUS.md"
echo "=================================================="
