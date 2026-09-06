ALTER TABLE "collection_receipts" ADD COLUMN "scheduleItemId" TEXT;
ALTER TABLE "collection_receipts" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'POSTED';
ALTER TABLE "collection_receipts" ADD COLUMN "voidedAt" TIMESTAMP(3);
ALTER TABLE "collection_receipts" ADD COLUMN "voidJournalId" TEXT;
