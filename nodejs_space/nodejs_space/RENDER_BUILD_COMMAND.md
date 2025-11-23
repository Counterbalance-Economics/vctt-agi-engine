
# Render Build Configuration

## Build Command
Update your Render service build command to:

```bash
cd nodejs_space && npm ci && npx prisma generate && npx prisma migrate deploy && npm run build
```

## Start Command (should already be set)
```bash
cd nodejs_space && node dist/src/main.js
```

## Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key
- `XAI_API_KEY` - xAI API key (for Grok)
- All other vars from .env.example

---

## What This Does:
1. `npm ci` - Clean install dependencies
2. `npx prisma generate` - Generate Prisma client
3. `npx prisma migrate deploy` - **Deploy database migrations** (THIS WAS MISSING!)
4. `npm run build` - Build the NestJS app

The missing step (#3) is why your tables don't exist in production!
