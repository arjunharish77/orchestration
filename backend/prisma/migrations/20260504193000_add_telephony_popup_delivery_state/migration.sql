ALTER TABLE "TelephonyAgentPopupEvent"
  ADD COLUMN "agentPhone" VARCHAR(10),
  ADD COLUMN "agentUserId" TEXT,
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "seenAt" TIMESTAMP(3),
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "lastSessionId" TEXT,
  ADD COLUMN "deliveryCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "TelephonyAgentPopupEvent_agentPhone_idx" ON "TelephonyAgentPopupEvent"("agentPhone");
CREATE INDEX "TelephonyAgentPopupEvent_agentUserId_idx" ON "TelephonyAgentPopupEvent"("agentUserId");
CREATE INDEX "TelephonyAgentPopupEvent_status_idx" ON "TelephonyAgentPopupEvent"("status");
