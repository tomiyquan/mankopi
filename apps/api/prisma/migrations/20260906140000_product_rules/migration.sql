ALTER TABLE "loan_products" ADD COLUMN "minPrincipal" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "loan_products" ADD COLUMN "maxPrincipal" DECIMAL(18,2);
UPDATE "loan_products" SET "minPrincipal" = 500000, "maxPrincipal" = 25000000 WHERE "code" = 'REGULER';
