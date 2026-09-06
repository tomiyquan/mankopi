ALTER TABLE "saving_accounts" ADD COLUMN "accountNo" TEXT;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "createdAt" ASC, id ASC) AS seq
  FROM "saving_accounts"
)
UPDATE "saving_accounts" AS s
SET "accountNo" = 'SMP-' || LPAD(n.seq::text, 4, '0')
FROM numbered n
WHERE s.id = n.id;

ALTER TABLE "saving_accounts" ALTER COLUMN "accountNo" SET NOT NULL;
CREATE UNIQUE INDEX "saving_accounts_tenantId_accountNo_key" ON "saving_accounts"("tenantId", "accountNo");
CREATE INDEX "saving_txns_accountId_occurredOn_idx" ON "saving_txns"("accountId", "occurredOn");
