CREATE TABLE "SavedLeadView" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filterForm" JSONB,
    "advancedMatch" TEXT NOT NULL DEFAULT 'all',
    "advancedConditions" JSONB,
    "visibleLeadFields" JSONB,
    "density" TEXT NOT NULL DEFAULT 'compact',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedLeadView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavedLeadView_userId_idx" ON "SavedLeadView"("userId");
CREATE INDEX "SavedLeadView_isDefault_idx" ON "SavedLeadView"("isDefault");
CREATE UNIQUE INDEX "SavedLeadView_user_default_unique" ON "SavedLeadView"("userId") WHERE "isDefault" = true;

ALTER TABLE "SavedLeadView" ADD CONSTRAINT "SavedLeadView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
