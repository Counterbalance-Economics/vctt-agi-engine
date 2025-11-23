
-- ============================================================================
-- VCTT-AGI: DeepAgent Sessions Integration
-- Phase 1: Manual Bridge for connecting Goals to DeepAgent coding environment
-- ============================================================================

-- DeepAgent Sessions Table
CREATE TABLE IF NOT EXISTS deepagent_sessions (
  id SERIAL PRIMARY KEY,
  session_uuid VARCHAR(100) UNIQUE NOT NULL, -- UUID for external reference
  goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
  subtask_id INTEGER REFERENCES goal_subtasks(id) ON DELETE CASCADE,
  
  -- Session Info
  status VARCHAR(50) NOT NULL DEFAULT 'created', -- created, in_progress, completed, failed, cancelled
  context JSONB NOT NULL, -- Task context passed to DeepAgent
  result JSONB, -- Results/output from DeepAgent session
  
  -- Metadata
  initiated_by VARCHAR(100) NOT NULL, -- 'human' | 'min' | 'system'
  deep_agent_url TEXT, -- URL to DeepAgent session (if applicable)
  error_message TEXT, -- If failed
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP, -- When work actually began
  completed_at TIMESTAMP, -- When marked complete
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Additional tracking
  metadata JSONB DEFAULT '{}'::jsonb,
  
  CONSTRAINT valid_session_status CHECK (status IN ('created', 'in_progress', 'completed', 'failed', 'cancelled'))
);

-- Session Activity Log (for tracking what happened in the session)
CREATE TABLE IF NOT EXISTS deepagent_session_activities (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES deepagent_sessions(id) ON DELETE CASCADE,
  activity_type VARCHAR(100) NOT NULL, -- 'created', 'started', 'file_created', 'error', 'completed', etc.
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_deepagent_sessions_goal ON deepagent_sessions(goal_id);
CREATE INDEX IF NOT EXISTS idx_deepagent_sessions_subtask ON deepagent_sessions(subtask_id);
CREATE INDEX IF NOT EXISTS idx_deepagent_sessions_status ON deepagent_sessions(status);
CREATE INDEX IF NOT EXISTS idx_deepagent_sessions_uuid ON deepagent_sessions(session_uuid);
CREATE INDEX IF NOT EXISTS idx_deepagent_session_activities_session ON deepagent_session_activities(session_id);
CREATE INDEX IF NOT EXISTS idx_deepagent_session_activities_timestamp ON deepagent_session_activities(timestamp DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_deepagent_sessions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deepagent_sessions_updated_at_trigger
BEFORE UPDATE ON deepagent_sessions
FOR EACH ROW
EXECUTE FUNCTION update_deepagent_sessions_timestamp();

-- Success
SELECT 'DeepAgent Sessions schema created successfully' AS status;
