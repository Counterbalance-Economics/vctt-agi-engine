-- Phase 4: Self-Improvement Loop Tables
-- CreateTable: scheduled_tasks
CREATE TABLE IF NOT EXISTS "scheduled_tasks" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "task_type" VARCHAR(50) NOT NULL,
    "scheduled_at" TIMESTAMP(6) NOT NULL,
    "recurrence_rule" VARCHAR(255),
    "goal_id" INTEGER,
    "created_by" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempted_at" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),
    "error_message" TEXT,
    "result_data" JSONB,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" VARCHAR(100),
    "approved_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduled_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tool_invocations
CREATE TABLE IF NOT EXISTS "tool_invocations" (
    "id" SERIAL NOT NULL,
    "session_id" TEXT NOT NULL,
    "tool_name" VARCHAR(100) NOT NULL,
    "input_data" JSONB NOT NULL,
    "output_data" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "invoked_by" VARCHAR(100) NOT NULL,
    "mode" VARCHAR(20) NOT NULL DEFAULT 'RESEARCH',
    "permission_level" VARCHAR(20) NOT NULL DEFAULT 'USER',
    "error_message" TEXT,
    "invoked_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(6),

    CONSTRAINT "tool_invocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: evaluations
CREATE TABLE IF NOT EXISTS "evaluations" (
    "id" SERIAL NOT NULL,
    "episode_id" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "output_summary" TEXT NOT NULL,
    "quality_score" DOUBLE PRECISION NOT NULL,
    "pattern_notes" TEXT,
    "suggested_skill" VARCHAR(255),
    "evaluated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: coach_proposals
CREATE TABLE IF NOT EXISTS "coach_proposals" (
    "id" SERIAL NOT NULL,
    "proposal_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "impact_summary" TEXT,
    "evaluation_ids" INTEGER[],
    "sample_instructions" TEXT[],
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "proposed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" VARCHAR(100),
    "reviewed_at" TIMESTAMP(6),
    "review_notes" TEXT,

    CONSTRAINT "coach_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable: skills
CREATE TABLE IF NOT EXISTS "skills" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "pattern_template" TEXT NOT NULL,
    "example_instructions" TEXT[],
    "success_rate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "source" VARCHAR(50) NOT NULL DEFAULT 'manual',
    "approved_by" VARCHAR(100),
    "approved_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tool_registry
CREATE TABLE IF NOT EXISTS "tool_registry" (
    "id" SERIAL NOT NULL,
    "tool_name" VARCHAR(100) NOT NULL,
    "description" TEXT NOT NULL,
    "allowed_modes" VARCHAR(20)[],
    "min_permission_level" VARCHAR(20) NOT NULL DEFAULT 'USER',
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable: autonomy_audit
CREATE TABLE IF NOT EXISTS "autonomy_audit" (
    "id" SERIAL NOT NULL,
    "action_type" VARCHAR(100) NOT NULL,
    "action_data" JSONB NOT NULL,
    "performed_by" VARCHAR(100) NOT NULL,
    "permission_level" VARCHAR(20) NOT NULL,
    "mode" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "error_message" TEXT,
    "performed_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "autonomy_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scheduled_tasks_status_idx" ON "scheduled_tasks"("status");
CREATE INDEX IF NOT EXISTS "scheduled_tasks_scheduled_at_idx" ON "scheduled_tasks"("scheduled_at");
CREATE INDEX IF NOT EXISTS "scheduled_tasks_goal_id_idx" ON "scheduled_tasks"("goal_id");

CREATE INDEX IF NOT EXISTS "tool_invocations_session_id_idx" ON "tool_invocations"("session_id");
CREATE INDEX IF NOT EXISTS "tool_invocations_tool_name_idx" ON "tool_invocations"("tool_name");
CREATE INDEX IF NOT EXISTS "tool_invocations_mode_idx" ON "tool_invocations"("mode");

CREATE INDEX IF NOT EXISTS "evaluations_episode_id_idx" ON "evaluations"("episode_id");
CREATE INDEX IF NOT EXISTS "evaluations_quality_score_idx" ON "evaluations"("quality_score");

CREATE INDEX IF NOT EXISTS "coach_proposals_status_idx" ON "coach_proposals"("status");
CREATE INDEX IF NOT EXISTS "coach_proposals_proposed_at_idx" ON "coach_proposals"("proposed_at");

CREATE UNIQUE INDEX IF NOT EXISTS "skills_name_key" ON "skills"("name");

CREATE UNIQUE INDEX IF NOT EXISTS "tool_registry_tool_name_key" ON "tool_registry"("tool_name");

CREATE INDEX IF NOT EXISTS "autonomy_audit_action_type_idx" ON "autonomy_audit"("action_type");
CREATE INDEX IF NOT EXISTS "autonomy_audit_performed_at_idx" ON "autonomy_audit"("performed_at");

-- AddForeignKey (if goals table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'goals') THEN
        ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_goal_id_fkey" 
        FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey (if episodes table exists)  
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'episodes') THEN
        ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_episode_id_fkey"
        FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
