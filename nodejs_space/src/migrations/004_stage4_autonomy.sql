
-- ═══════════════════════════════════════════════════════════
-- STAGE 4: CONSTRAINED AUTONOMY & SELF-IMPROVEMENT
-- ═══════════════════════════════════════════════════════════
-- This migration enables MIN to become an operational Tier-4 AGI
-- with constrained autonomy, self-scheduling, and self-improvement.
-- ═══════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────┐
-- │ 1. SCHEDULED TASKS - Deferred/Periodic/Reminder Tasks  │
-- └─────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id SERIAL PRIMARY KEY,
  
  -- Task identification
  title VARCHAR(255) NOT NULL,
  description TEXT,
  task_type VARCHAR(50) NOT NULL, -- 'deferred', 'periodic', 'reminder'
  
  -- Scheduling
  scheduled_at TIMESTAMP NOT NULL, -- When to run (deferred/reminder)
  cron_expression VARCHAR(100), -- For periodic tasks (e.g., "0 3 * * *" = 3 AM daily)
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Execution
  status VARCHAR(50) DEFAULT 'pending', -- pending, running, completed, failed, cancelled
  priority INTEGER DEFAULT 3, -- 1-5 (5 = highest)
  timeout_seconds INTEGER DEFAULT 300, -- 5 minutes default
  max_retries INTEGER DEFAULT 3,
  retry_count INTEGER DEFAULT 0,
  
  -- Tool invocation
  tool_name VARCHAR(100) NOT NULL, -- 'run_tests', 'search_files', etc.
  tool_params JSONB NOT NULL, -- Parameters for the tool
  
  -- Safety & governance
  goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE, -- MUST be linked to approved goal
  created_by VARCHAR(100) NOT NULL, -- 'human', 'min', 'system'
  requires_approval BOOLEAN DEFAULT false, -- Human approval before execution
  approved_by VARCHAR(100), -- Who approved (if requires_approval=true)
  approved_at TIMESTAMP,
  
  -- Execution results
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  result JSONB, -- Tool output
  error TEXT,
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT valid_task_type CHECK (task_type IN ('deferred', 'periodic', 'reminder')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  CONSTRAINT valid_priority CHECK (priority BETWEEN 1 AND 5),
  CONSTRAINT approved_if_required CHECK (
    (requires_approval = false) OR 
    (requires_approval = true AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
  )
);

CREATE INDEX idx_scheduled_tasks_scheduled_at ON scheduled_tasks(scheduled_at);
CREATE INDEX idx_scheduled_tasks_status ON scheduled_tasks(status);
CREATE INDEX idx_scheduled_tasks_goal_id ON scheduled_tasks(goal_id);
CREATE INDEX idx_scheduled_tasks_created_by ON scheduled_tasks(created_by);

COMMENT ON TABLE scheduled_tasks IS 'MIN autonomous task scheduler - all tasks must be linked to approved goals';
COMMENT ON COLUMN scheduled_tasks.cron_expression IS 'Standard cron syntax: minute hour day month weekday';
COMMENT ON COLUMN scheduled_tasks.requires_approval IS 'If true, task will not run until approved by human';


-- ┌─────────────────────────────────────────────────────────┐
-- │ 2. TOOL INVOCATIONS - Complete Audit Log               │
-- └─────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS tool_invocations (
  id SERIAL PRIMARY KEY,
  
  -- Tool identification
  tool_name VARCHAR(100) NOT NULL,
  tool_version VARCHAR(20) DEFAULT '1.0.0',
  
  -- Context
  session_id VARCHAR(255), -- Link to conversation session
  goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
  task_id INTEGER REFERENCES scheduled_tasks(id) ON DELETE SET NULL,
  
  -- Invocation details
  invoked_by VARCHAR(100) NOT NULL, -- 'human', 'min', 'planner', 'orchestrator'
  invoked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Reasoning & Intent
  why TEXT NOT NULL, -- Why this tool was called (natural language explanation)
  params JSONB NOT NULL, -- Tool parameters
  
  -- Execution
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  status VARCHAR(50) NOT NULL, -- 'success', 'failure', 'timeout', 'blocked'
  
  -- Results
  result JSONB, -- Tool output
  error TEXT,
  
  -- Safety & Permissions
  regulation_mode VARCHAR(50) NOT NULL, -- Mode when invoked
  permission_level VARCHAR(50) NOT NULL, -- 'read_only', 'write_with_approval', 'full'
  blocked BOOLEAN DEFAULT false, -- Was this call blocked by guardrails?
  block_reason TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  CONSTRAINT valid_status CHECK (status IN ('success', 'failure', 'timeout', 'blocked'))
);

CREATE INDEX idx_tool_invocations_tool_name ON tool_invocations(tool_name);
CREATE INDEX idx_tool_invocations_invoked_by ON tool_invocations(invoked_by);
CREATE INDEX idx_tool_invocations_status ON tool_invocations(status);
CREATE INDEX idx_tool_invocations_goal_id ON tool_invocations(goal_id);
CREATE INDEX idx_tool_invocations_invoked_at ON tool_invocations(invoked_at);

COMMENT ON TABLE tool_invocations IS 'Complete audit log of all tool invocations - critical for transparency and self-improvement';
COMMENT ON COLUMN tool_invocations.why IS 'Natural language explanation of WHY this tool was invoked (for Coach analysis)';


-- ┌─────────────────────────────────────────────────────────┐
-- │ 3. EVALUATIONS - Self-Improvement Data                 │
-- └─────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS evaluations (
  id SERIAL PRIMARY KEY,
  
  -- Episode identification
  session_id VARCHAR(255) NOT NULL,
  episode_type VARCHAR(50) NOT NULL, -- 'code_edit', 'conversation', 'task_execution'
  
  -- Performance metrics
  trust_tau FLOAT NOT NULL, -- Final trust score
  latency_ms INTEGER NOT NULL,
  cost_usd FLOAT,
  
  -- Quality indicators
  human_rating INTEGER, -- 1-5 rating from user (optional)
  human_feedback TEXT,
  contradiction_count INTEGER DEFAULT 0,
  repair_count INTEGER DEFAULT 0,
  
  -- Agent performance
  models_used JSONB, -- Which models were involved
  planner_reasoning TEXT, -- Planner's reasoning for Coach analysis
  tool_calls_count INTEGER DEFAULT 0,
  
  -- Outcome
  success BOOLEAN NOT NULL,
  error_type VARCHAR(100), -- If failed, what type of error
  
  -- Context
  instruction TEXT, -- User's original request
  response_summary TEXT, -- Summary of MIN's response
  
  -- Timestamps
  evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  CONSTRAINT valid_episode_type CHECK (episode_type IN ('code_edit', 'conversation', 'task_execution', 'goal_planning')),
  CONSTRAINT valid_human_rating CHECK (human_rating IS NULL OR (human_rating BETWEEN 1 AND 5))
);

CREATE INDEX idx_evaluations_session_id ON evaluations(session_id);
CREATE INDEX idx_evaluations_episode_type ON evaluations(episode_type);
CREATE INDEX idx_evaluations_evaluated_at ON evaluations(evaluated_at);
CREATE INDEX idx_evaluations_trust_tau ON evaluations(trust_tau);
CREATE INDEX idx_evaluations_success ON evaluations(success);

COMMENT ON TABLE evaluations IS 'Self-improvement data - Coach analyzes this nightly to propose improvements';
COMMENT ON COLUMN evaluations.planner_reasoning IS 'WHY the planner made certain decisions - critical for Coach learning';


-- ┌─────────────────────────────────────────────────────────┐
-- │ 4. COACH PROPOSALS - Improvement Suggestions            │
-- └─────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS coach_proposals (
  id SERIAL PRIMARY KEY,
  
  -- Proposal identification
  title VARCHAR(255) NOT NULL,
  proposal_type VARCHAR(50) NOT NULL, -- 'prompt_improvement', 'strategy_change', 'skill_extraction', 'parameter_tuning'
  
  -- Analysis
  analysis_summary TEXT NOT NULL, -- What the Coach learned from evaluations
  sample_size INTEGER NOT NULL, -- How many episodes analyzed
  confidence_score FLOAT NOT NULL, -- 0-1 confidence in this proposal
  
  -- Proposed change
  current_behavior TEXT, -- Current prompt/strategy
  proposed_behavior TEXT NOT NULL, -- Proposed new prompt/strategy
  expected_improvement TEXT NOT NULL, -- What should improve (τ, latency, cost, etc.)
  
  -- Supporting data
  supporting_evaluations JSONB, -- IDs of evaluations that support this
  metrics JSONB, -- Before/after metrics projection
  
  -- Human review
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, testing
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  
  -- Testing (A/B test phase)
  testing_started_at TIMESTAMP,
  testing_ended_at TIMESTAMP,
  test_results JSONB,
  
  -- Implementation
  implemented_at TIMESTAMP,
  implementation_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  CONSTRAINT valid_proposal_type CHECK (proposal_type IN ('prompt_improvement', 'strategy_change', 'skill_extraction', 'parameter_tuning')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'testing', 'implemented')),
  CONSTRAINT valid_confidence CHECK (confidence_score BETWEEN 0 AND 1)
);

CREATE INDEX idx_coach_proposals_status ON coach_proposals(status);
CREATE INDEX idx_coach_proposals_proposal_type ON coach_proposals(proposal_type);
CREATE INDEX idx_coach_proposals_created_at ON coach_proposals(created_at);

COMMENT ON TABLE coach_proposals IS 'Coach-generated improvement proposals - NEVER auto-applied, always require human approval';
COMMENT ON COLUMN coach_proposals.confidence_score IS 'How confident Coach is in this proposal (based on sample size and effect size)';


-- ┌─────────────────────────────────────────────────────────┐
-- │ 5. SKILLS - Proven Pattern Library                     │
-- └─────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS skills (
  id SERIAL PRIMARY KEY,
  
  -- Skill identification
  skill_name VARCHAR(100) NOT NULL UNIQUE,
  skill_version VARCHAR(20) DEFAULT '1.0.0',
  category VARCHAR(50) NOT NULL, -- 'refactoring', 'testing', 'debugging', 'architecture'
  
  -- Description
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  use_cases TEXT[], -- When to use this skill
  
  -- Implementation
  prompt_template TEXT NOT NULL, -- Prompt that invokes this skill
  required_context TEXT[], -- What context is needed
  required_tools TEXT[], -- What tools this skill uses
  
  -- Performance
  success_rate FLOAT, -- 0-1 based on evaluations
  avg_trust_tau FLOAT,
  avg_latency_ms INTEGER,
  usage_count INTEGER DEFAULT 0,
  
  -- Learning
  extracted_from_evaluation_ids JSONB, -- Which evaluations led to this skill
  last_refined_at TIMESTAMP,
  refinement_notes TEXT,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- active, deprecated, testing
  approved_by VARCHAR(100) NOT NULL,
  approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  CONSTRAINT valid_category CHECK (category IN ('refactoring', 'testing', 'debugging', 'architecture', 'performance', 'security', 'documentation')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'deprecated', 'testing'))
);

CREATE INDEX idx_skills_skill_name ON skills(skill_name);
CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_status ON skills(status);
CREATE INDEX idx_skills_success_rate ON skills(success_rate);

COMMENT ON TABLE skills IS 'Proven pattern library - extracted from successful episodes, invokable by Planner';
COMMENT ON COLUMN skills.prompt_template IS 'Template that Planner can fill in to invoke this skill';
COMMENT ON COLUMN skills.success_rate IS 'Calculated from evaluations where this skill was used';


-- ┌─────────────────────────────────────────────────────────┐
-- │ 6. TOOL REGISTRY - Standardized Tool Definitions       │
-- └─────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS tool_registry (
  id SERIAL PRIMARY KEY,
  
  -- Tool identification
  tool_name VARCHAR(100) NOT NULL UNIQUE,
  tool_version VARCHAR(20) DEFAULT '1.0.0',
  
  -- Description
  description TEXT NOT NULL,
  input_schema JSONB NOT NULL, -- JSON schema for parameters
  output_schema JSONB NOT NULL, -- JSON schema for results
  
  -- Permissions
  min_regulation_mode VARCHAR(50) NOT NULL, -- Minimum mode required (RESEARCH, DEVELOPMENT, AUTONOMOUS)
  requires_approval BOOLEAN DEFAULT false, -- Require human approval?
  sandbox_only BOOLEAN DEFAULT false, -- Can only run in sandbox?
  
  -- Rate limiting
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_hour INTEGER DEFAULT 1000,
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- active, deprecated, disabled
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  CONSTRAINT valid_min_mode CHECK (min_regulation_mode IN ('RESEARCH', 'DEVELOPMENT', 'AUTONOMOUS', 'EMERGENCY')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'deprecated', 'disabled'))
);

CREATE INDEX idx_tool_registry_tool_name ON tool_registry(tool_name);
CREATE INDEX idx_tool_registry_status ON tool_registry(status);

COMMENT ON TABLE tool_registry IS 'Central registry of all available tools with permissions and schemas';

-- Seed the tool registry with final tool list
INSERT INTO tool_registry (tool_name, description, input_schema, output_schema, min_regulation_mode, requires_approval, sandbox_only) VALUES
  ('read_file', 'Read file contents from filesystem', '{"path": "string"}', '{"content": "string", "size": "number"}', 'RESEARCH', false, false),
  ('write_file', 'Write content to file (creates if not exists)', '{"path": "string", "content": "string"}', '{"success": "boolean", "bytes_written": "number"}', 'DEVELOPMENT', false, true),
  ('search_files', 'Search for text across project files', '{"query": "string", "path": "string?"}', '{"results": "array"}', 'RESEARCH', false, false),
  ('apply_patch', 'Apply a code patch to a file', '{"path": "string", "patch": "string"}', '{"success": "boolean", "applied_lines": "number"}', 'DEVELOPMENT', true, true),
  ('run_tests', 'Execute test suite', '{"path": "string?", "command": "string?"}', '{"success": "boolean", "output": "string"}', 'DEVELOPMENT', false, true),
  ('safe_shell', 'Execute shell command (sandboxed)', '{"command": "string", "timeout": "number?"}', '{"stdout": "string", "stderr": "string", "exit_code": "number"}', 'DEVELOPMENT', true, true),
  ('http_request', 'Make HTTP request to external API', '{"url": "string", "method": "string", "body": "any?"}', '{"status": "number", "data": "any"}', 'DEVELOPMENT', false, false)
ON CONFLICT (tool_name) DO NOTHING;


-- ┌─────────────────────────────────────────────────────────┐
-- │ 7. AUTONOMY AUDIT - High-level oversight log           │
-- └─────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS autonomy_audit (
  id SERIAL PRIMARY KEY,
  
  -- Event
  event_type VARCHAR(50) NOT NULL, -- 'task_scheduled', 'task_executed', 'approval_requested', 'mode_change', 'skill_invoked'
  actor VARCHAR(100) NOT NULL, -- Who triggered this (human, min, system)
  
  -- Context
  regulation_mode VARCHAR(50) NOT NULL,
  goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
  task_id INTEGER REFERENCES scheduled_tasks(id) ON DELETE SET NULL,
  tool_invocation_id INTEGER REFERENCES tool_invocations(id) ON DELETE SET NULL,
  
  -- Details
  details JSONB NOT NULL,
  risk_level VARCHAR(20), -- 'low', 'medium', 'high'
  
  -- Outcome
  outcome VARCHAR(50), -- 'allowed', 'blocked', 'pending_approval'
  block_reason TEXT,
  
  -- Timestamp
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  CONSTRAINT valid_event_type CHECK (event_type IN ('task_scheduled', 'task_executed', 'approval_requested', 'mode_change', 'skill_invoked', 'coach_proposal')),
  CONSTRAINT valid_risk_level CHECK (risk_level IS NULL OR risk_level IN ('low', 'medium', 'high')),
  CONSTRAINT valid_outcome CHECK (outcome IS NULL OR outcome IN ('allowed', 'blocked', 'pending_approval', 'approved', 'rejected'))
);

CREATE INDEX idx_autonomy_audit_event_type ON autonomy_audit(event_type);
CREATE INDEX idx_autonomy_audit_actor ON autonomy_audit(actor);
CREATE INDEX idx_autonomy_audit_recorded_at ON autonomy_audit(recorded_at);
CREATE INDEX idx_autonomy_audit_outcome ON autonomy_audit(outcome);

COMMENT ON TABLE autonomy_audit IS 'High-level audit log of all autonomous actions - for human oversight';


-- ═══════════════════════════════════════════════════════════
-- MIGRATION COMPLETE
-- ═══════════════════════════════════════════════════════════
-- MIN now has the database foundation for:
-- ✅ Task scheduling (deferred, periodic, reminders)
-- ✅ Complete tool audit trail
-- ✅ Self-evaluation data collection
-- ✅ Coach-driven self-improvement
-- ✅ Proven skill library
-- ✅ Standardized tool registry
-- ✅ Full autonomy audit trail
--
-- Next: Implement the services that use these tables.
-- ═══════════════════════════════════════════════════════════
