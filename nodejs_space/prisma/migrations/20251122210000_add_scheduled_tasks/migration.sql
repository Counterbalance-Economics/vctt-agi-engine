-- CreateTable
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

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scheduled_tasks_status_idx" ON "scheduled_tasks"("status");
CREATE INDEX IF NOT EXISTS "scheduled_tasks_scheduled_at_idx" ON "scheduled_tasks"("scheduled_at");
CREATE INDEX IF NOT EXISTS "scheduled_tasks_goal_id_idx" ON "scheduled_tasks"("goal_id");

-- AddForeignKey (if goal table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'goals') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'scheduled_tasks_goal_id_fkey'
        ) THEN
            ALTER TABLE "scheduled_tasks" 
            ADD CONSTRAINT "scheduled_tasks_goal_id_fkey" 
            FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
    END IF;
END $$;
