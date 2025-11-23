
-- ============================================================================
-- VCTT-AGI Stage 3: Goal System
-- Self-aware goal tracking, hierarchy, and state management
-- ============================================================================

-- Goals Table (Core)
CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'proposed',
  priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
  owner VARCHAR(100) NOT NULL, -- 'human' | 'system' | 'min'
  parent_goal_id INTEGER REFERENCES goals(id) ON DELETE CASCADE,
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  CONSTRAINT valid_status CHECK (status IN ('proposed', 'active', 'paused', 'completed', 'abandoned'))
);

-- Goal Constraints Table
CREATE TABLE IF NOT EXISTS goal_constraints (
  id SERIAL PRIMARY KEY,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  constraint_type VARCHAR(50) NOT NULL, -- 'dependency' | 'resource' | 'time' | 'safety'
  constraint_value TEXT NOT NULL,
  is_blocking BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Goal Progress Table
CREATE TABLE IF NOT EXISTS goal_progress (
  id SERIAL PRIMARY KEY,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  milestone VARCHAR(255),
  notes TEXT,
  recorded_by VARCHAR(100) NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Goal Audit Table (Full Transparency)
CREATE TABLE IF NOT EXISTS goal_audit (
  id SERIAL PRIMARY KEY,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'created' | 'activated' | 'paused' | 'completed' | 'abandoned' | 'updated'
  actor VARCHAR(100) NOT NULL, -- who performed the action
  reason TEXT,
  before_state JSONB,
  after_state JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  regulation_mode VARCHAR(50), -- capture mode at time of action
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_owner ON goals(owner);
CREATE INDEX IF NOT EXISTS idx_goals_priority ON goals(priority);
CREATE INDEX IF NOT EXISTS idx_goals_parent ON goals(parent_goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_constraints_goal ON goal_constraints(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_progress_goal ON goal_progress(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_audit_goal ON goal_audit(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_audit_timestamp ON goal_audit(timestamp DESC);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_goals_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER goals_updated_at_trigger
BEFORE UPDATE ON goals
FOR EACH ROW
EXECUTE FUNCTION update_goals_timestamp();

-- Success
SELECT 'Goal System schema created successfully' AS status;
