CREATE TABLE "primeniversary_registrations" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "patient_name" TEXT NOT NULL,
    "patient_phone" TEXT NOT NULL,
    "patient_email" TEXT,
    "price" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "consent_at" TIMESTAMPTZ(3) NOT NULL,
    "paid_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "confirmed_by" TEXT,
    "cancelled_at" TIMESTAMPTZ(3),
    "cancelled_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "primeniversary_registrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "primeniversary_registrations_request_id_key" ON "primeniversary_registrations"("request_id");
CREATE UNIQUE INDEX "primeniversary_registrations_code_key" ON "primeniversary_registrations"("code");
CREATE INDEX "primeniversary_registrations_status_created_at_idx" ON "primeniversary_registrations"("status", "created_at");
CREATE INDEX "primeniversary_registrations_patient_phone_idx" ON "primeniversary_registrations"("patient_phone");
