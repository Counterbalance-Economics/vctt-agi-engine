-- Fix scheduled_tasks schema to match Prisma model
-- Add missing columns if they don't exist

-- Drop columns that don't exist in schema
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'recurrence_rule') THEN
        ALTER TABLE "scheduled_tasks" DROP COLUMN "recurrence_rule";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'last_attempted_at') THEN
        ALTER TABLE "scheduled_tasks" DROP COLUMN "last_attempted_at";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'error_message') THEN
        ALTER TABLE "scheduled_tasks" DROP COLUMN "error_message";
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'result_data') THEN
        ALTER TABLE "scheduled_tasks" DROP COLUMN "result_data";
    END IF;
END $$;

-- Add missing columns
DO $$
BEGIN
    -- cron_expression
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'cron_expression') THEN
        ALTER TABLE "scheduled_tasks" ADD COLUMN "cron_expression" VARCHAR(100);
    END IF;
    
    -- timezone
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'timezone') THEN
        ALTER TABLE "scheduled_tasks" ADD COLUMN "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC';
    END IF;
    
    -- priority
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'priority') THEN
        ALTER TABLE "scheduled_tasks" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 3;
    END IF;
    
    -- timeout_seconds
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'timeout_seconds') THEN
        ALTER TABLE "scheduled_tasks" ADD COLUMN "timeout_seconds" INTEGER NOT NULL DEFAULT 300;
    END IF;
    
    -- max_retries
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'max_retries') THEN
        ALTER TABLE "scheduled_tasks" ADD COLUMN "max_retries" INTEGER NOT NULL DEFAULT 3;
    END IF;
    
    -- tool_name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'tool_name') THEN
        ALTER TABLE "scheduled_tasks" ADD COLUMN "tool_name" VARCHAR(100) NOT NULL DEFAULT 'unknown';
    END IF;
    
    -- tool_params
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'tool_params') THEN
        ALTER TABLE "scheduled_tasks" ADD COLUMN "tool_params" JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
    
    -- started_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'started_at') THEN
        ALTER TABLE "scheduled_tasks" ADD COLUMN "started_at" TIMESTAMP(6);
    END IF;
    
    -- result (rename from result_data if exists, else create)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'result') THEN
        ALTER TABLE "scheduled_tasks" ADD COLUMN "result" JSONB;
    END IF;
    
    -- error (rename from error_message if exists, else create)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'error') THEN
        ALTER TABLE "scheduled_tasks" ADD COLUMN "error" TEXT;
    END IF;
    
    -- metadata
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'metadata') THEN
        ALTER TABLE "scheduled_tasks" ADD COLUMN "metadata" JSONB;
    END IF;
END $$;

-- Update status column type if needed
ALTER TABLE "scheduled_tasks" ALTER COLUMN "status" TYPE VARCHAR(50);

-- Create missing indexes
CREATE INDEX IF NOT EXISTS "scheduled_tasks_created_by_idx" ON "scheduled_tasks"("created_by");
