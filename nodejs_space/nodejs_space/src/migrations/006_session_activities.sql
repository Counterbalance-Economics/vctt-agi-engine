
-- Migration 006: Session Activities for Phase 2 Auto-Sync
-- Purpose: Track DeepAgent work activities and enable real-time updates

-- Activity log table - tracks what MIN is doing in real-time
CREATE TABLE IF NOT EXISTS session_activities (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL REFERENCES deepagent_sessions(session_id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    severity VARCHAR(20) DEFAULT 'info',
    created_at TIMESTAMP DEFAULT NOW(),
    
    CONSTRAINT valid_activity_type CHECK (activity_type IN (
        'session_started', 'file_created', 'file_edited', 'file_deleted',
        'command_run', 'api_call', 'error', 'warning', 'progress_update',
        'checkpoint', 'completed', 'failed'
    )),
    CONSTRAINT valid_severity CHECK (severity IN ('info', 'success', 'warning', 'error'))
);

CREATE INDEX idx_session_activities_session_id ON session_activities(session_id);
CREATE INDEX idx_session_activities_created_at ON session_activities(created_at DESC);
CREATE INDEX idx_session_activities_type ON session_activities(activity_type);

-- Session progress tracking
CREATE TABLE IF NOT EXISTS session_progress (
    session_id VARCHAR(36) PRIMARY KEY REFERENCES deepagent_sessions(session_id) ON DELETE CASCADE,
    current_phase VARCHAR(100),
    progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    files_modified INTEGER DEFAULT 0,
    commands_run INTEGER DEFAULT 0,
    errors_encountered INTEGER DEFAULT 0,
    last_activity TEXT,
    last_activity_at TIMESTAMP DEFAULT NOW(),
    estimated_completion TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add completion metadata to deepagent_sessions
ALTER TABLE deepagent_sessions 
ADD COLUMN IF NOT EXISTS completion_detected_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS auto_synced_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'synced', 'failed'));

COMMENT ON TABLE session_activities IS 'Real-time log of DeepAgent work activities for Phase 2 Auto-Sync';
COMMENT ON TABLE session_progress IS 'Current progress summary for each DeepAgent session';
