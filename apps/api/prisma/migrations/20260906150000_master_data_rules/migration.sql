ALTER TABLE "saving_products" ADD COLUMN "withdrawable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "saving_products" ADD COLUMN "openOnJoin" BOOLEAN NOT NULL DEFAULT true;
UPDATE "saving_products" SET "withdrawable" = true WHERE "kind" = 'SUKARELA';
