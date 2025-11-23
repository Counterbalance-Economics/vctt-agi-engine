
-- ============================================
-- STAGE 3: GOAL SYSTEM TABLES
-- Self-aware goal tracking, hierarchy, and state management
-- ============================================

-- Goals Table (Core)
CREATE TABLE IF NOT EXISTS "goals" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'proposed',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "owner" VARCHAR(100) NOT NULL,
    "parent_goal_id" INTEGER,
    "created_by" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(6),
    "metadata" JSONB,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "goals_parent_goal_id_fkey" FOREIGN KEY ("parent_goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Goal Constraints Table
CREATE TABLE IF NOT EXISTS "goal_constraints" (
    "id" SERIAL NOT NULL,
    "goal_id" INTEGER NOT NULL,
    "constraint_type" VARCHAR(50) NOT NULL,
    "constraint_value" TEXT NOT NULL,
    "is_blocking" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "goal_constraints_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "goal_constraints_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Goal Progress Table
CREATE TABLE IF NOT EXISTS "goal_progress" (
    "id" SERIAL NOT NULL,
    "goal_id" INTEGER NOT NULL,
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "milestone" VARCHAR(255),
    "notes" TEXT,
    "recorded_by" VARCHAR(100) NOT NULL,
    "recorded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "goal_progress_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "goal_progress_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Goal Audit Table (Full Transparency)
CREATE TABLE IF NOT EXISTS "goal_audit" (
    "id" SERIAL NOT NULL,
    "goal_id" INTEGER NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "actor" VARCHAR(100) NOT NULL,
    "reason" TEXT,
    "before_state" JSONB,
    "after_state" JSONB,
    "timestamp" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "regulation_mode" VARCHAR(50),
    "metadata" JSONB,

    CONSTRAINT "goal_audit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "goal_audit_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_goals_status" ON "goals"("status");
CREATE INDEX IF NOT EXISTS "idx_goals_owner" ON "goals"("owner");
CREATE INDEX IF NOT EXISTS "idx_goals_priority" ON "goals"("priority");
CREATE INDEX IF NOT EXISTS "idx_goals_parent" ON "goals"("parent_goal_id");
CREATE INDEX IF NOT EXISTS "idx_goal_constraints_goal" ON "goal_constraints"("goal_id");
CREATE INDEX IF NOT EXISTS "idx_goal_progress_goal" ON "goal_progress"("goal_id");
CREATE INDEX IF NOT EXISTS "idx_goal_audit_goal" ON "goal_audit"("goal_id");
CREATE INDEX IF NOT EXISTS "idx_goal_audit_timestamp" ON "goal_audit"("timestamp" DESC);
