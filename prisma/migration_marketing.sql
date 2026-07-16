-- Migration: Digital Marketing Dashboard (Derma Rich Wellness)
-- Description: Assignment tracker + comments for marketing subdomain

CREATE TABLE IF NOT EXISTS "marketing_assignments" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'design_request',
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'todo',
  "priority" TEXT NOT NULL DEFAULT 'medium',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "assignee_clerk_id" TEXT,
  "assignee_name" TEXT,
  "assignee_email" TEXT,
  "requester_clerk_id" TEXT,
  "requester_name" TEXT,
  "due_date" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "marketing_assignments_status_priority_idx"
  ON "marketing_assignments" ("status", "priority");
CREATE INDEX IF NOT EXISTS "marketing_assignments_assignee_idx"
  ON "marketing_assignments" ("assignee_clerk_id");
CREATE INDEX IF NOT EXISTS "marketing_assignments_type_idx"
  ON "marketing_assignments" ("type");

CREATE TABLE IF NOT EXISTS "marketing_comments" (
  "id" TEXT PRIMARY KEY,
  "assignment_id" TEXT NOT NULL REFERENCES "marketing_assignments"("id") ON DELETE CASCADE,
  "author_clerk_id" TEXT,
  "author_name" TEXT,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "marketing_comments_assignment_idx"
  ON "marketing_comments" ("assignment_id");
