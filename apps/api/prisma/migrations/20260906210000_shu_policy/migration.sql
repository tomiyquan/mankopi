CREATE TABLE "expense_budget_policies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percent" DECIMAL(7,2) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_budget_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "expense_budget_policies_tenantId_accountCode_key" ON "expense_budget_policies"("tenantId", "accountCode");
CREATE INDEX "expense_budget_policies_tenantId_idx" ON "expense_budget_policies"("tenantId");
ALTER TABLE "expense_budget_policies" ADD CONSTRAINT "expense_budget_policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ckpn_rates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "percent" DECIMAL(7,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ckpn_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ckpn_rates_tenantId_grade_key" ON "ckpn_rates"("tenantId", "grade");
CREATE INDEX "ckpn_rates_tenantId_idx" ON "ckpn_rates"("tenantId");
ALTER TABLE "ckpn_rates" ADD CONSTRAINT "ckpn_rates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "shu_share_policies" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percent" DECIMAL(7,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shu_share_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shu_share_policies_tenantId_accountCode_key" ON "shu_share_policies"("tenantId", "accountCode");
CREATE INDEX "shu_share_policies_tenantId_idx" ON "shu_share_policies"("tenantId");
ALTER TABLE "shu_share_policies" ADD CONSTRAINT "shu_share_policies_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "year_closes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "phuNet" DECIMAL(18,2) NOT NULL,
    "closeJournalId" TEXT,
    "allocateJournalId" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allocatedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "year_closes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "year_closes_tenantId_year_key" ON "year_closes"("tenantId", "year");
CREATE INDEX "year_closes_tenantId_idx" ON "year_closes"("tenantId");
ALTER TABLE "year_closes" ADD CONSTRAINT "year_closes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "expense_budget_policies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY expense_budget_policies_isolation ON "expense_budget_policies" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "ckpn_rates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY ckpn_rates_isolation ON "ckpn_rates" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "shu_share_policies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY shu_share_policies_isolation ON "shu_share_policies" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
ALTER TABLE "year_closes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY year_closes_isolation ON "year_closes" USING (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true)) WITH CHECK (current_setting('app.bypass_rls', true) = 'on' OR "tenantId" = current_setting('app.tenant_id', true));
