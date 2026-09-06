-- AlterTable
ALTER TABLE "members" ADD COLUMN "unitId" TEXT;

-- CreateIndex
CREATE INDEX "members_branchId_idx" ON "members"("branchId");
CREATE INDEX "members_unitId_idx" ON "members"("unitId");

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill members without a branch to the tenant HQ (or first active branch).
UPDATE "members" AS m
SET "branchId" = b.id
FROM (
  SELECT DISTINCT ON ("tenantId") id, "tenantId"
  FROM "branches"
  WHERE status = 'ACTIVE'
  ORDER BY "tenantId", CASE WHEN code = 'HQ' THEN 0 ELSE 1 END, "createdAt"
) AS b
WHERE m."branchId" IS NULL AND m."tenantId" = b."tenantId";
