
# 🔴 PRODUCTION DEPLOYMENT FIX REQUIRED

## Issue Summary

Your production backend on Render is crashing every 30 seconds because the **execution queue tables don't exist** in the production database.

## Error Details

```
❌ Orchestration error: relation "execution_queue" does not exist
QueryFailedError: relation "execution_queue" does not exist
```

**What's happening:**
- The autonomous orchestrator runs every 30 seconds (cron job)
- It tries to query `execution_queue` table
- Table doesn't exist in production (only exists locally)
- Orchestrator crashes
- Repeat every 30 seconds ♻️

## Why This Happened

We created the tables locally via manual SQL migration, but production database on Render never received the migration.

## ✅ SOLUTION (One-Time Fix)

I've added a migration endpoint that you can trigger **once** to create all required tables.

### Step 1: Wait for Render to Deploy

Render should auto-deploy the latest commit within 5-10 minutes:
- Commit: `708e594` - "Add database migration endpoint to fix production deployment"
- Check deployment status: https://dashboard.render.com/

### Step 2: Trigger the Migration

Once deployed, run this command **once**:

```bash
curl -X POST https://vctt-agi-backend.onrender.com/api/autonomous/migrate
```

**Expected response:**
```json
{
  "success": true,
  "message": "Database migration completed successfully",
  "tables_created": [
    "execution_queue",
    "execution_logs", 
    "agent_pool"
  ],
  "indexes_created": 4
}
```

### Step 3: Verify It Worked

Check the logs after migration - orchestration errors should stop:

```bash
# Check status endpoint
curl https://vctt-agi-backend.onrender.com/api/autonomous/status

# Should return queue status without errors
```

## What Gets Created

**Tables:**
1. `execution_queue` - Queue for autonomous goal execution
2. `execution_logs` - Detailed execution logs per goal
3. `agent_pool` - Agent availability tracking

**Indexes:**
- `idx_execution_queue_status` - Fast status lookups
- `idx_execution_queue_goal` - Fast goal lookups
- `idx_execution_logs_goal` - Fast log queries
- `idx_agent_pool_status` - Fast agent status checks

## After Migration

Once tables are created:
- ✅ Orchestrator will run successfully every 30 seconds
- ✅ Goals can be queued for execution
- ✅ DeepAgent sessions will spawn
- ✅ Execution logs will be recorded
- ✅ No more crashes

## Other Issues (Non-Critical)

### 1. Embedding API Unauthorized

```
ERROR [EmbeddingsService] Failed to generate embedding: Embedding API error: Unauthorized
```

**Impact:** Memories are stored but without vector embeddings for semantic search.

**Fix (Optional):**
Add embedding API key to Render environment variables:
- Service: xai (already configured locally)
- Key: `XAI_API_KEY`

### 2. Root Path 404s (Expected)

```
❌ HEAD / → 404 Cannot HEAD /
❌ GET / → 404 Cannot GET /
```

These are health check pings from Render. They're harmless and expected. All real API routes (under `/api/*`) work fine.

## Commit History

**Latest commits pushed:**
1. `708e594` - Add database migration endpoint to fix production deployment
2. `e1ca3ab` - Add Grok-4 pricing
3. `d7d2938` - Docs: Add complete integration summary for Goals page

**GitHub:** https://github.com/Counterbalance-Economics/vctt-agi-engine

## Testing After Fix

Once migration is complete, test the full flow:

```bash
# 1. Create a goal
curl -X POST https://vctt-agi-backend.onrender.com/api/goals \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test goal",
    "description": "Testing production deployment",
    "mode": "autonomous",
    "owner": "human",
    "createdBy": "test",
    "actor": "user"
  }'

# 2. Queue it (should work now!)
curl -X POST https://vctt-agi-backend.onrender.com/api/autonomous/queue \
  -H "Content-Type: application/json" \
  -d '{"goal_id": 1, "priority": 5}'

# 3. Check status (should show queued goal)
curl https://vctt-agi-backend.onrender.com/api/autonomous/status

# 4. Trigger orchestration
curl -X POST https://vctt-agi-backend.onrender.com/api/autonomous/orchestrate

# 5. Check logs (should show execution progress)
curl https://vctt-agi-backend.onrender.com/api/autonomous/logs/1
```

## Summary

**Action Required:** Run migration endpoint once after Render deploys latest code.

**Command:**
```bash
curl -X POST https://vctt-agi-backend.onrender.com/api/autonomous/migrate
```

**Then:** Verify orchestration errors stop in Render logs.

**Result:** MIN will be fully operational and autonomous execution will work! 🚀
