ALTER TABLE "loans" ADD COLUMN "decisionKind" TEXT;
ALTER TABLE "loans" ADD COLUMN "decisionNote" TEXT;
ALTER TABLE "loans" ADD COLUMN "decisionConditions" TEXT;
ALTER TABLE "loans" ADD COLUMN "decidedAt" TIMESTAMP(3);
ALTER TABLE "loans" ADD COLUMN "decidedById" TEXT;
ALTER TABLE "loans" ADD COLUMN "conditionsClearedAt" TIMESTAMP(3);
ALTER TABLE "loans" ADD COLUMN "conditionsClearedById" TEXT;

CREATE INDEX "loans_decidedById_idx" ON "loans"("decidedById");

ALTER TABLE "loans" ADD CONSTRAINT "loans_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
