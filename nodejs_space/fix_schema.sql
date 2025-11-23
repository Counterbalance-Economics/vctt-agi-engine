
-- ============================================
-- VCTT-AGI Schema Fix Script
-- Fixes: coach_proposals, evaluations, skills
-- Date: 2025-11-23
-- ============================================

-- ============================================
-- 1. FIX COACH_PROPOSALS TABLE
-- ============================================

DROP TABLE IF EXISTS "coach_proposals" CASCADE;

CREATE TABLE "coach_proposals" (
  "id" SERIAL PRIMARY KEY,
  "title" VARCHAR(255) NOT NULL,
  "proposal_type" VARCHAR(50) NOT NULL,
  "analysis_summary" TEXT NOT NULL,
  "sample_size" INTEGER NOT NULL,
  "confidence_score" DOUBLE PRECISION NOT NULL,
  "current_behavior" TEXT,
  "proposed_behavior" TEXT NOT NULL,
  "expected_improvement" TEXT NOT NULL,
  "supporting_evaluations" JSONB,
  "metrics" JSONB,
  "status" VARCHAR(50) DEFAULT 'pending' NOT NULL,
  "reviewed_by" VARCHAR(100),
  "reviewed_at" TIMESTAMP(6),
  "review_notes" TEXT,
  "testing_started_at" TIMESTAMP(6),
  "testing_ended_at" TIMESTAMP(6),
  "test_results" JSONB,
  "implemented_at" TIMESTAMP(6),
  "implementation_notes" TEXT,
  "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "metadata" JSONB
);

CREATE INDEX "idx_coach_proposals_status" ON "coach_proposals"("status");
CREATE INDEX "idx_coach_proposals_type" ON "coach_proposals"("proposal_type");
CREATE INDEX "idx_coach_proposals_created" ON "coach_proposals"("created_at");

-- ============================================
-- 2. FIX EVALUATIONS TABLE
-- ============================================

DROP TABLE IF EXISTS "evaluations" CASCADE;

CREATE TABLE "evaluations" (
  "id" SERIAL PRIMARY KEY,
  "goal_id" INTEGER,
  "episode_id" VARCHAR(255),
  "session_id" VARCHAR(255) NOT NULL,
  "episode_type" VARCHAR(50) NOT NULL,
  
  -- Trust metrics (tau)
  "tau_start" DOUBLE PRECISION,
  "tau_end" DOUBLE PRECISION,
  "tau_delta" DOUBLE PRECISION,
  "trust_tau" DOUBLE PRECISION NOT NULL,
  
  -- Performance metrics
  "latency_ms" INTEGER NOT NULL,
  "cost_usd" DOUBLE PRECISION,
  "success_score" INTEGER,
  "success" BOOLEAN NOT NULL,
  
  -- Human feedback
  "human_rating" INTEGER,
  "human_feedback" TEXT,
  
  -- Quality metrics
  "contradiction_count" INTEGER DEFAULT 0 NOT NULL,
  "repair_count" INTEGER DEFAULT 0 NOT NULL,
  "tool_calls_count" INTEGER DEFAULT 0 NOT NULL,
  
  -- Execution data
  "models_used" JSONB,
  "tools_used" JSONB,
  "planner_reasoning" TEXT,
  
  -- Outcome
  "error_type" VARCHAR(100),
  "instruction" TEXT,
  "response_summary" TEXT,
  
  -- Timestamps
  "evaluated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "metadata" JSONB,
  
  -- Foreign key
  CONSTRAINT "fk_evaluations_goal" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL
);

CREATE INDEX "idx_evaluations_goal" ON "evaluations"("goal_id");
CREATE INDEX "idx_evaluations_session" ON "evaluations"("session_id");
CREATE INDEX "idx_evaluations_type" ON "evaluations"("episode_type");
CREATE INDEX "idx_evaluations_evaluated_at" ON "evaluations"("evaluated_at");
CREATE INDEX "idx_evaluations_trust_tau" ON "evaluations"("trust_tau");
CREATE INDEX "idx_evaluations_tau_delta" ON "evaluations"("tau_delta");
CREATE INDEX "idx_evaluations_success" ON "evaluations"("success");
CREATE INDEX "idx_evaluations_success_score" ON "evaluations"("success_score");

-- ============================================
-- 3. CREATE SKILLS TABLE
-- ============================================

DROP TABLE IF EXISTS "skills" CASCADE;

CREATE TABLE "skills" (
  "id" SERIAL PRIMARY KEY,
  "skill_name" VARCHAR(100) UNIQUE NOT NULL,
  "skill_version" VARCHAR(20) DEFAULT '1.0.0' NOT NULL,
  "category" VARCHAR(50) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT NOT NULL,
  "use_cases" TEXT[] NOT NULL,
  "prompt_template" TEXT NOT NULL,
  "required_context" TEXT[] NOT NULL,
  "required_tools" TEXT[] NOT NULL,
  "success_rate" DOUBLE PRECISION,
  "avg_trust_tau" DOUBLE PRECISION,
  "avg_latency_ms" INTEGER,
  "usage_count" INTEGER DEFAULT 0 NOT NULL,
  "extracted_from_evaluation_ids" JSONB,
  "last_refined_at" TIMESTAMP(6),
  "refinement_notes" TEXT,
  "status" VARCHAR(50) DEFAULT 'active' NOT NULL,
  "approved_by" VARCHAR(100) NOT NULL,
  "approved_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "metadata" JSONB
);

CREATE INDEX "idx_skills_name" ON "skills"("skill_name");
CREATE INDEX "idx_skills_category" ON "skills"("category");
CREATE INDEX "idx_skills_status" ON "skills"("status");
CREATE INDEX "idx_skills_success_rate" ON "skills"("success_rate");

-- ============================================
-- 4. CREATE SKILL_CANDIDATES TABLE (if needed)
-- ============================================

DROP TABLE IF EXISTS "skill_candidates" CASCADE;

CREATE TABLE "skill_candidates" (
  "id" SERIAL PRIMARY KEY,
  "candidate_name" VARCHAR(100) NOT NULL,
  "category" VARCHAR(50) NOT NULL,
  "description" TEXT NOT NULL,
  "pattern_detected" TEXT NOT NULL,
  "sample_evaluations" JSONB,
  "success_rate" DOUBLE PRECISION NOT NULL,
  "avg_trust_tau" DOUBLE PRECISION NOT NULL,
  "sample_size" INTEGER NOT NULL,
  "confidence_score" DOUBLE PRECISION NOT NULL,
  "status" VARCHAR(50) DEFAULT 'pending' NOT NULL,
  "reviewed_by" VARCHAR(100),
  "reviewed_at" TIMESTAMP(6),
  "promoted_to_skill_id" INTEGER,
  "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "metadata" JSONB
);

CREATE INDEX "idx_skill_candidates_status" ON "skill_candidates"("status");
CREATE INDEX "idx_skill_candidates_category" ON "skill_candidates"("category");
CREATE INDEX "idx_skill_candidates_success_rate" ON "skill_candidates"("success_rate");

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check table structures
SELECT 
  table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('coach_proposals', 'evaluations', 'skills', 'skill_candidates')
GROUP BY table_name
ORDER BY table_name;

-- Show all columns for verification
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('coach_proposals', 'evaluations', 'skills', 'skill_candidates')
ORDER BY table_name, ordinal_position;
