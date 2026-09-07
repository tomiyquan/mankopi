-- AlterTable
ALTER TABLE "saving_txns" ADD COLUMN "txnNo" TEXT;
ALTER TABLE "saving_txns" ADD COLUMN "method" TEXT NOT NULL DEFAULT 'CASH';
ALTER TABLE "saving_txns" ADD COLUMN "note" TEXT;
ALTER TABLE "saving_txns" ADD COLUMN "counterAccountId" TEXT;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "createdAt" ASC, id ASC) AS seq
  FROM "saving_txns"
)
UPDATE "saving_txns" AS s
SET "txnNo" = 'SM-' || LPAD(n.seq::text, 4, '0')
FROM numbered n
WHERE s.id = n.id;

ALTER TABLE "saving_txns" ALTER COLUMN "txnNo" SET NOT NULL;
CREATE UNIQUE INDEX "saving_txns_tenantId_txnNo_key" ON "saving_txns"("tenantId", "txnNo");
