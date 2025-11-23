
# 🔧 Prisma P3005 Baseline Fix

## Problem
Prisma refuses to run migrations on a non-empty database without establishing a baseline first.

**Error:**
```
Error: P3005
The database schema is not empty.
Read more about how to baseline an existing production database: https://pris.ly/d/migrate-baseline
```

## Solution (Pick One)

### Option 1: Run Baseline Locally (Recommended - 60 seconds)

**Prerequisites:**
- Access to your production PostgreSQL connection string
- Node.js/npm installed locally

**Steps:**

```bash
# 1. Navigate to the project
cd /home/ubuntu/vctt_agi_engine/nodejs_space

# 2. Set production database URL
export DATABASE_URL="postgresql://user:password@host:port/database"

# 3. Run the baseline setup script
./setup-baseline.sh
```

**What this does:**
1. Marks `0_baseline` as applied (tells Prisma "start here")
2. Runs all existing migrations with `IF NOT EXISTS` clauses
3. Creates all missing tables (goals, skills, coach_proposals, etc.)

**Expected output:**
```
🗄️  Setting up Prisma baseline for production database...
📍 Marking baseline migration as applied...
Migration 0_baseline marked as applied.
🚀 Deploying all migrations...
✅ Migration applied: 20251121213500_stage3_goal_system
✅ Migration applied: 20251122000000_phase4_self_improvement
✅ Baseline setup complete! All migrations deployed.
```

### Option 2: Update Render Build Command (Alternative)

If you don't want to run locally, update Render to handle baseline automatically:

**New Build Command:**
```bash
cd nodejs_space && npm ci && npx prisma generate && npx prisma migrate resolve --applied 0_baseline || true && npx prisma migrate deploy && npm run build
```

**Explanation:**
- `npx prisma migrate resolve --applied 0_baseline || true` - Marks baseline as applied (ignores error if already done)
- `npx prisma migrate deploy` - Deploys all migrations
- `|| true` - Continues even if baseline was already applied

---

## After Fix

Once baseline is established, **all future deployments work automatically** with the original command:

```bash
cd nodejs_space && npm ci && npx prisma generate && npx prisma migrate deploy && npm run build
```

---

## Verification

After running baseline, test these endpoints:

```bash
curl https://vctt-agi-backend.onrender.com/api/goals?status=active
curl https://vctt-agi-backend.onrender.com/api/coach/proposals?status=pending
curl https://vctt-agi-backend.onrender.com/api/skills/candidates?minTau=0.85&minCount=3
```

All should return `200 OK` with `[]` (empty arrays).

---

## What Gets Created

**Phase 3 Tables:**
- `goals` - Goal tracking
- `goal_constraints` - Goal constraints
- `goal_progress` - Progress tracking
- `goal_audit` - Audit trail
- `scheduled_tasks` - Scheduled tasks

**Phase 4 Tables:**
- `evaluations` - Session evaluations
- `coach_proposals` - Self-improvement proposals
- `skills` - Learned skills library
- `tool_invocations` - Tool usage tracking
- `tool_registry` - Available tools
- `autonomy_audit` - Autonomy audit trail

**Total: 11 tables + indexes + foreign keys**

---

## Troubleshooting

### "baseline already applied"
✅ Good! Skip to step 3 (`npx prisma migrate deploy`)

### "P2021: table does not exist"
❌ Run baseline first: `npx prisma migrate resolve --applied 0_baseline`

### "Connection refused"
❌ Check DATABASE_URL is correct and database is accessible

---

## Next Steps

1. ✅ Run baseline (Option 1 or 2 above)
2. ✅ Commit and push changes: `git push origin main`
3. ✅ Deploy to Render (manual deploy)
4. ✅ Verify all endpoints return 200
5. ✅ Frontend loads without errors
6. ✅ Record Loom demo
7. ✅ **LAUNCH** 🚀
