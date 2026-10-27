CREATE TABLE "whatsapp_otp_dispatches" (
    "message_id_hash" TEXT NOT NULL,
    "challenge_id_hash" TEXT NOT NULL,
    "flow" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error_code" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "whatsapp_otp_dispatches_pkey" PRIMARY KEY ("message_id_hash")
);

CREATE INDEX "whatsapp_otp_dispatches_flow_challenge_id_hash_idx" ON "whatsapp_otp_dispatches"("flow", "challenge_id_hash");
CREATE INDEX "whatsapp_otp_dispatches_created_at_idx" ON "whatsapp_otp_dispatches"("created_at");
