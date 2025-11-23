
-- CreateTable
CREATE TABLE "goal_activity_logs" (
    "id" SERIAL NOT NULL,
    "goal_id" INTEGER NOT NULL,
    "actor" VARCHAR(100) NOT NULL,
    "activity_type" VARCHAR(50) NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_subtasks" (
    "id" SERIAL NOT NULL,
    "goal_id" INTEGER NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "estimated_effort" VARCHAR(50),
    "created_by" VARCHAR(100) NOT NULL DEFAULT 'min',
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "goal_subtasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_state" (
    "id" SERIAL NOT NULL,
    "is_running" BOOLEAN NOT NULL DEFAULT false,
    "current_goal_id" INTEGER,
    "started_at" TIMESTAMP(6),
    "stopped_at" TIMESTAMP(6),
    "total_goals_processed" INTEGER NOT NULL DEFAULT 0,
    "total_subtasks_completed" INTEGER NOT NULL DEFAULT 0,
    "last_heartbeat" TIMESTAMP(6),
    "error_message" TEXT,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "execution_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_activity_logs_goal" ON "goal_activity_logs"("goal_id");

-- CreateIndex
CREATE INDEX "idx_activity_logs_timestamp" ON "goal_activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_activity_logs_actor" ON "goal_activity_logs"("actor");

-- CreateIndex
CREATE INDEX "idx_subtasks_goal" ON "goal_subtasks"("goal_id");

-- CreateIndex
CREATE INDEX "idx_subtasks_status" ON "goal_subtasks"("status");

-- AddForeignKey
ALTER TABLE "goal_activity_logs" ADD CONSTRAINT "goal_activity_logs_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_subtasks" ADD CONSTRAINT "goal_subtasks_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
