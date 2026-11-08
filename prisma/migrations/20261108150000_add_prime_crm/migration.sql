-- CreateTable
CREATE TABLE "crm_grants" (
    "staff_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "crm_grants_pkey" PRIMARY KEY ("staff_id")
);

-- CreateTable
CREATE TABLE "crm_events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "event_date" DATE NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_sso_tickets" (
    "token_hash" TEXT NOT NULL,
    "challenge_hash" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "crm_sso_tickets_pkey" PRIMARY KEY ("token_hash")
);
CREATE INDEX "crm_sso_tickets_expires_at_idx" ON "crm_sso_tickets"("expires_at");
ALTER TABLE "crm_sso_tickets" ADD CONSTRAINT "crm_sso_tickets_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "crm_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "crm_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phone_normalized" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "event_id" TEXT,
    "campaign_id" TEXT,
    "interest" TEXT,
    "notes" TEXT,
    "assigned_to" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "next_follow_up" DATE,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lead_events" (
    "lead_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lead_events_pkey" PRIMARY KEY ("lead_id","event_id")
);

-- CreateTable
CREATE TABLE "crm_follow_ups" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "event_id" TEXT,
    "actor_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "next_follow_up" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_spend" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "spend_date" DATE NOT NULL,
    "amount" DECIMAL(14,0) NOT NULL,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "crm_spend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_spend_history" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "spend_date" DATE NOT NULL,
    "previous" DECIMAL(14,0),
    "amount" DECIMAL(14,0) NOT NULL,
    "actor_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_spend_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_reservation_links" (
    "reservation_id" TEXT NOT NULL,
    "request_key" TEXT,
    "lead_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "event_id" TEXT,
    "campaign_id" TEXT,
    "created_by" TEXT NOT NULL,
    "visit_result" TEXT NOT NULL DEFAULT 'PENDING',
    "cancellation_reason" TEXT,
    "notes" TEXT,
    "rescheduled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_reservation_links_pkey" PRIMARY KEY ("reservation_id")
);

-- CreateTable
CREATE TABLE "crm_import_batches" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "rows" JSONB NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'READY',
    "result" JSONB,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_reservation_history" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_reservation_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_reservation_history_reservation_id_created_at_idx" ON "crm_reservation_history"("reservation_id", "created_at");
ALTER TABLE "crm_reservation_history" ADD CONSTRAINT "crm_reservation_history_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "crm_reservation_links"("reservation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "crm_import_files" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "crm_import_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crm_events_name_event_date_key" ON "crm_events"("name", "event_date");

-- CreateIndex
CREATE UNIQUE INDEX "crm_campaigns_platform_name_key" ON "crm_campaigns"("platform", "name");

-- CreateIndex
CREATE UNIQUE INDEX "crm_leads_phone_normalized_key" ON "crm_leads"("phone_normalized");

-- CreateIndex
CREATE INDEX "crm_leads_status_next_follow_up_idx" ON "crm_leads"("status", "next_follow_up");

-- CreateIndex
CREATE INDEX "crm_leads_assigned_to_status_idx" ON "crm_leads"("assigned_to", "status");

-- CreateIndex
CREATE INDEX "crm_lead_events_event_id_lead_id_idx" ON "crm_lead_events"("event_id", "lead_id");

-- CreateIndex
CREATE INDEX "crm_follow_ups_lead_id_created_at_idx" ON "crm_follow_ups"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "crm_follow_ups_event_id_lead_id_idx" ON "crm_follow_ups"("event_id", "lead_id");

-- CreateIndex
CREATE INDEX "crm_spend_spend_date_idx" ON "crm_spend"("spend_date");

-- CreateIndex
CREATE UNIQUE INDEX "crm_spend_campaign_id_spend_date_key" ON "crm_spend"("campaign_id", "spend_date");

-- CreateIndex
CREATE INDEX "crm_spend_history_campaign_id_spend_date_idx" ON "crm_spend_history"("campaign_id", "spend_date");

-- CreateIndex
CREATE INDEX "crm_reservation_links_lead_id_idx" ON "crm_reservation_links"("lead_id");

CREATE UNIQUE INDEX "crm_reservation_links_request_key_key" ON "crm_reservation_links"("request_key");

-- CreateIndex
CREATE INDEX "crm_reservation_links_event_id_idx" ON "crm_reservation_links"("event_id");

-- CreateIndex
CREATE INDEX "crm_reservation_links_campaign_id_idx" ON "crm_reservation_links"("campaign_id");

-- CreateIndex
CREATE INDEX "crm_import_batches_actor_id_expires_at_idx" ON "crm_import_batches"("actor_id", "expires_at");

-- CreateIndex
CREATE INDEX "crm_import_files_batch_id_idx" ON "crm_import_files"("batch_id");

-- AddForeignKey
ALTER TABLE "crm_grants" ADD CONSTRAINT "crm_grants_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "crm_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "crm_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_events" ADD CONSTRAINT "crm_lead_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_events" ADD CONSTRAINT "crm_lead_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "crm_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_follow_ups" ADD CONSTRAINT "crm_follow_ups_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_follow_ups" ADD CONSTRAINT "crm_follow_ups_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "crm_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_spend" ADD CONSTRAINT "crm_spend_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "crm_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_spend_history" ADD CONSTRAINT "crm_spend_history_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "crm_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_reservation_links" ADD CONSTRAINT "crm_reservation_links_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_reservation_links" ADD CONSTRAINT "crm_reservation_links_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_reservation_links" ADD CONSTRAINT "crm_reservation_links_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "crm_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_reservation_links" ADD CONSTRAINT "crm_reservation_links_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "crm_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_import_files" ADD CONSTRAINT "crm_import_files_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "crm_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "crm_grants" ADD CONSTRAINT "crm_grants_role_check" CHECK ("role" IN ('ADMIN','MARKETING','FRONT_OFFICE','MANAGEMENT'));
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_source_check" CHECK ("source" IN ('ADS','ORGANIC','REFERRAL','EVENT','WALK_IN','OTHER'));
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_status_check" CHECK ("status" IN ('NEW','CONTACTED','NO_RESPONSE','INTERESTED','FOLLOW_UP','NOT_INTERESTED'));
ALTER TABLE "crm_campaigns" ADD CONSTRAINT "crm_campaigns_status_check" CHECK ("status" IN ('ACTIVE','ARCHIVED'));
ALTER TABLE "crm_spend" ADD CONSTRAINT "crm_spend_amount_check" CHECK ("amount" >= 0);
ALTER TABLE "crm_reservation_links" ADD CONSTRAINT "crm_reservation_visit_result_check" CHECK ("visit_result" IN ('PENDING','CONSULTATION','TREATMENT','NO_SHOW'));

-- Only these pre-authorized, already-registered staff accounts receive initial access.
INSERT INTO "crm_grants" ("staff_id", "role", "active", "updated_at")
SELECT "id", 'ADMIN', true, CURRENT_TIMESTAMP FROM "staff_accounts"
WHERE "active" = true AND lower("email") IN ('drwprimegejayan@gmail.com','drwcorpora@gmail.com')
ON CONFLICT ("staff_id") DO NOTHING;
