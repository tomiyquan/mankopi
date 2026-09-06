CREATE TABLE "members" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "memberNo" TEXT NOT NULL,
    "nik" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "placeOfBirth" TEXT,
    "dateOfBirth" DATE,
    "motherName" TEXT,
    "slikConsentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "members_tenantId_memberNo_key" ON "members"("tenantId", "memberNo");
CREATE UNIQUE INDEX "members_tenantId_nik_key" ON "members"("tenantId", "nik");
CREATE INDEX "members_tenantId_idx" ON "members"("tenantId");
ALTER TABLE "members" ADD CONSTRAINT "members_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "members" ADD CONSTRAINT "members_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "saving_products" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "minAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "saving_products_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "saving_products_tenantId_code_key" ON "saving_products"("tenantId", "code");
ALTER TABLE "saving_products" ADD CONSTRAINT "saving_products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "saving_accounts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "saving_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "saving_accounts_memberId_productId_key" ON "saving_accounts"("memberId", "productId");
CREATE INDEX "saving_accounts_tenantId_idx" ON "saving_accounts"("tenantId");
ALTER TABLE "saving_accounts" ADD CONSTRAINT "saving_accounts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saving_accounts" ADD CONSTRAINT "saving_accounts_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saving_accounts" ADD CONSTRAINT "saving_accounts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "saving_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "saving_txns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "journalId" TEXT,
    "occurredOn" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "saving_txns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "saving_txns_tenantId_occurredOn_idx" ON "saving_txns"("tenantId", "occurredOn");
ALTER TABLE "saving_txns" ADD CONSTRAINT "saving_txns_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "saving_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "loan_products" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "annualRate" DECIMAL(8,4) NOT NULL,
    "periods" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "loan_products_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "loan_products_tenantId_code_key" ON "loan_products"("tenantId", "code");
ALTER TABLE "loan_products" ADD CONSTRAINT "loan_products_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "loanNo" TEXT NOT NULL,
    "principal" DECIMAL(18,2) NOT NULL,
    "outstandingPrincipal" DECIMAL(18,2) NOT NULL,
    "annualRate" DECIMAL(8,4) NOT NULL,
    "method" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "periods" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "collectability" INTEGER NOT NULL DEFAULT 1,
    "disbursedOn" DATE,
    "journalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "loans_tenantId_loanNo_key" ON "loans"("tenantId", "loanNo");
CREATE INDEX "loans_tenantId_idx" ON "loans"("tenantId");
ALTER TABLE "loans" ADD CONSTRAINT "loans_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loans" ADD CONSTRAINT "loans_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loans" ADD CONSTRAINT "loans_productId_fkey" FOREIGN KEY ("productId") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "loan_schedule_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "principalDue" DECIMAL(18,2) NOT NULL,
    "interestDue" DECIMAL(18,2) NOT NULL,
    "penaltyDue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "principalPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "interestPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "penaltyPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DUE',
    CONSTRAINT "loan_schedule_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "loan_schedule_items_loanId_sequence_key" ON "loan_schedule_items"("loanId", "sequence");
CREATE INDEX "loan_schedule_items_tenantId_dueDate_idx" ON "loan_schedule_items"("tenantId", "dueDate");
ALTER TABLE "loan_schedule_items" ADD CONSTRAINT "loan_schedule_items_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tenant_holidays" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "tenant_holidays_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tenant_holidays_tenantId_date_name_key" ON "tenant_holidays"("tenantId", "date", "name");
ALTER TABLE "tenant_holidays" ADD CONSTRAINT "tenant_holidays_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "collection_receipts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "collectorId" TEXT,
    "receiptNo" TEXT NOT NULL,
    "clientReceiptId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "journalId" TEXT,
    "paidOn" DATE NOT NULL,
    "allocation" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "collection_receipts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "collection_receipts_tenantId_clientReceiptId_key" ON "collection_receipts"("tenantId", "clientReceiptId");
CREATE UNIQUE INDEX "collection_receipts_tenantId_receiptNo_key" ON "collection_receipts"("tenantId", "receiptNo");
CREATE INDEX "collection_receipts_tenantId_paidOn_idx" ON "collection_receipts"("tenantId", "paidOn");
ALTER TABLE "collection_receipts" ADD CONSTRAINT "collection_receipts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "collection_receipts" ADD CONSTRAINT "collection_receipts_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collection_receipts" ADD CONSTRAINT "collection_receipts_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "collection_receipts" ADD CONSTRAINT "collection_receipts_collectorId_fkey" FOREIGN KEY ("collectorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;
CREATE POLICY members_isolation ON "members" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "saving_products" ENABLE ROW LEVEL SECURITY;
CREATE POLICY saving_products_isolation ON "saving_products" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "saving_accounts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY saving_accounts_isolation ON "saving_accounts" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "saving_txns" ENABLE ROW LEVEL SECURITY;
CREATE POLICY saving_txns_isolation ON "saving_txns" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "loan_products" ENABLE ROW LEVEL SECURITY;
CREATE POLICY loan_products_isolation ON "loan_products" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "loans" ENABLE ROW LEVEL SECURITY;
CREATE POLICY loans_isolation ON "loans" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "loan_schedule_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY loan_schedule_items_isolation ON "loan_schedule_items" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "tenant_holidays" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_holidays_isolation ON "tenant_holidays" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "collection_receipts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY collection_receipts_isolation ON "collection_receipts" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
