
-- Migration: Add goal_artifacts table for completed builds and deliverables
-- Date: 2025-11-23
-- Purpose: Store build outputs, URLs, files, and other artifacts created by MIN

CREATE TABLE IF NOT EXISTS goal_artifacts (
  id SERIAL PRIMARY KEY,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  artifact_type VARCHAR(50) NOT NULL, -- code, url, file, screenshot, document, deployment
  artifact_name VARCHAR(500) NOT NULL,
  artifact_description TEXT,
  artifact_path TEXT, -- File path or URL
  artifact_data TEXT, -- Small inline content (code snippets, JSON, etc.)
  file_size INTEGER, -- Size in bytes
  mime_type VARCHAR(100),
  metadata JSONB, -- Additional metadata (language, framework, etc.)
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100) NOT NULL DEFAULT 'min'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_artifacts_goal ON goal_artifacts(goal_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON goal_artifacts(artifact_type);
CREATE INDEX IF NOT EXISTS idx_artifacts_created ON goal_artifacts(created_at);

-- Add comment
COMMENT ON TABLE goal_artifacts IS 'Stores completed builds, outputs, and deliverables from MIN executions';
