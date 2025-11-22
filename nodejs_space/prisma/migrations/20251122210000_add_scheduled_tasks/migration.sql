-- CreateTable: scheduled_tasks (matching exact Prisma schema)
CREATE TABLE IF NOT EXISTS "scheduled_tasks" (
    "id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "task_type" VARCHAR(50) NOT NULL,
    "scheduled_at" TIMESTAMP(6) NOT NULL,
    "cron_expression" VARCHAR(100),
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "timeout_seconds" INTEGER NOT NULL DEFAULT 300,
    "max_retries" INTEGER NOT NULL DEFAULT 3,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "tool_name" VARCHAR(100) NOT NULL,
    "tool_params" JSONB NOT NULL,
    "goal_id" INTEGER,
    "created_by" VARCHAR(100) NOT NULL,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" VARCHAR(100),
    "approved_at" TIMESTAMP(6),
    "started_at" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),
    "result" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "scheduled_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "scheduled_tasks_scheduled_at_idx" ON "scheduled_tasks"("scheduled_at");
CREATE INDEX IF NOT EXISTS "scheduled_tasks_status_idx" ON "scheduled_tasks"("status");
CREATE INDEX IF NOT EXISTS "scheduled_tasks_goal_id_idx" ON "scheduled_tasks"("goal_id");
CREATE INDEX IF NOT EXISTS "scheduled_tasks_created_by_idx" ON "scheduled_tasks"("created_by");

-- AddForeignKey (if goals table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'goals') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'scheduled_tasks_goal_id_fkey'
        ) THEN
            ALTER TABLE "scheduled_tasks" 
            ADD CONSTRAINT "scheduled_tasks_goal_id_fkey" 
            FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;
