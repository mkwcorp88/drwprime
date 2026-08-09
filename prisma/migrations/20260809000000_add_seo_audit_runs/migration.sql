-- SEO audit history written by /api/cron/seo-audit and read by /admin/seo.
CREATE TABLE "seo_audit_runs" (
    "id" TEXT NOT NULL,
    "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "health_score" INTEGER NOT NULL,
    "checks" JSONB NOT NULL,
    "rankings" JSONB NOT NULL,
    "notes" TEXT,

    CONSTRAINT "seo_audit_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "seo_audit_runs_run_at_idx" ON "seo_audit_runs"("run_at");
