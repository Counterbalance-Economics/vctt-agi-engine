
-- Migration 007: Autonomous Execution System
-- Adds tables for autonomous task execution, queue management, and execution logs

-- Execution Queue - Tasks waiting to be processed by MIN
CREATE TABLE IF NOT EXISTS execution_queue (
    id SERIAL PRIMARY KEY,
    goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    subtask_id INTEGER REFERENCES subtasks(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 3,
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    -- Status: queued, processing, completed, failed, cancelled
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    assigned_agent VARCHAR(100), -- Which agent is processing this
    session_id VARCHAR(255), -- DeepAgent session ID if active
    error_message TEXT,
    queued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Execution Logs - Detailed logs of autonomous execution
CREATE TABLE IF NOT EXISTS execution_logs (
    id SERIAL PRIMARY KEY,
    queue_id INTEGER REFERENCES execution_queue(id) ON DELETE CASCADE,
    goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
    log_level VARCHAR(20) NOT NULL, -- info, warning, error, success
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Agent Pool - Track available agents and their status
CREATE TABLE IF NOT EXISTS agent_pool (
    id SERIAL PRIMARY KEY,
    agent_id VARCHAR(100) NOT NULL UNIQUE,
    agent_type VARCHAR(50) NOT NULL, -- deepagent, min_worker, etc.
    status VARCHAR(50) NOT NULL DEFAULT 'idle',
    -- Status: idle, busy, offline, error
    current_task_id INTEGER REFERENCES execution_queue(id),
    capabilities JSONB DEFAULT '[]',
    max_parallel_tasks INTEGER NOT NULL DEFAULT 1,
    current_load INTEGER NOT NULL DEFAULT 0,
    last_heartbeat TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Coach Proposals from Execution - Improvements suggested based on work done
CREATE TABLE IF NOT EXISTS coach_execution_proposals (
    id SERIAL PRIMARY KEY,
    queue_id INTEGER REFERENCES execution_queue(id) ON DELETE CASCADE,
    goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
    proposal_type VARCHAR(50) NOT NULL,
    -- Type: optimization, refactor, bug_fix, feature, test_coverage
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    rationale TEXT,
    estimated_impact VARCHAR(20), -- low, medium, high, critical
    auto_approved BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- Status: pending, approved, rejected, implemented
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_execution_queue_status ON execution_queue(status);
CREATE INDEX IF NOT EXISTS idx_execution_queue_priority ON execution_queue(priority DESC);
CREATE INDEX IF NOT EXISTS idx_execution_queue_goal ON execution_queue(goal_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_queue ON execution_logs(queue_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_timestamp ON execution_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_pool_status ON agent_pool(status);
CREATE INDEX IF NOT EXISTS idx_coach_proposals_status ON coach_execution_proposals(status);
CREATE INDEX IF NOT EXISTS idx_coach_proposals_goal ON coach_execution_proposals(goal_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_execution_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER execution_queue_update_timestamp
    BEFORE UPDATE ON execution_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_execution_timestamp();

CREATE TRIGGER agent_pool_update_timestamp
    BEFORE UPDATE ON agent_pool
    FOR EACH ROW
    EXECUTE FUNCTION update_execution_timestamp();

CREATE TRIGGER coach_proposals_update_timestamp
    BEFORE UPDATE ON coach_execution_proposals
    FOR EACH ROW
    EXECUTE FUNCTION update_execution_timestamp();

COMMENT ON TABLE execution_queue IS 'Queue of tasks for autonomous execution by MIN';
COMMENT ON TABLE execution_logs IS 'Detailed logs of autonomous execution activities';
COMMENT ON TABLE agent_pool IS 'Pool of available agents for task execution';
COMMENT ON TABLE coach_execution_proposals IS 'Improvement proposals generated from execution analysis';
