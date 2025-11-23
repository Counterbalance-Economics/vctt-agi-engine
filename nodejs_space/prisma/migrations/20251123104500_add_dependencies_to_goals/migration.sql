
-- AlterTable
ALTER TABLE "goals" ADD COLUMN "dependencies" JSONB DEFAULT '[]';

-- Add comment
COMMENT ON COLUMN "goals"."dependencies" IS 'Array of goal IDs this goal depends on';
