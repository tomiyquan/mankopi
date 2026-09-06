import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_CKPN_RATES, DEFAULT_COA_TEMPLATE, DEFAULT_EXPENSE_BUDGETS, DEFAULT_SHU_SHARES } from "@mankopi/ledger-engine";
import { INDONESIA_NATIONAL_HOLIDAYS_2026 } from "@mankopi/loan-engine";
import { PERMISSIONS, ROLE_PERMISSION_MAP } from "@mankopi/shared";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

for (const file of [resolve(__dirname, "../.env"), resolve(__dirname, "../../../.env")]) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 1) continue;
      const key = trimmed.slice(0, eq);
      const value = trimmed.slice(eq + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* optional env file */
  }
}

const prisma = new PrismaClient();

async function seedInTx() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;

    for (const perm of PERMISSIONS) {
      await tx.permission.upsert({
        where: { key: perm.key },
        update: { resource: perm.resource, action: perm.action, description: perm.description },
        create: { key: perm.key, resource: perm.resource, action: perm.action, description: perm.description },
      });
    }

    const allPerms = await tx.permission.findMany();
    const permByKey = Object.fromEntries(allPerms.map((p) => [p.key, p.id]));

    async function upsertRole(
      slug: string,
      name: string,
      layer: "PLATFORM" | "TENANT",
      tenantId: string | null,
      keys: readonly string[],
    ) {
      const existing = tenantId
        ? await tx.role.findFirst({ where: { slug, tenantId } })
        : await tx.role.findFirst({ where: { slug, tenantId: null } });
      const role = existing
        ? await tx.role.update({
            where: { id: existing.id },
            data: { name, layer, isSystem: true },
          })
        : await tx.role.create({
            data: { slug, name, layer, tenantId, isSystem: true },
          });
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({
        data: keys.map((key) => ({ roleId: role.id, permissionId: permByKey[key] })).filter((r) => r.permissionId),
      });
      return role;
    }

    const platformRole = await upsertRole(
      "platform_admin",
      "Platform Admin",
      "PLATFORM",
      null,
      ROLE_PERMISSION_MAP.platform_admin,
    );

    const tenantTemplates = [
      ["ketua", "Ketua / Pengurus"],
      ["manajer_cabang", "Manajer Cabang"],
      ["bendahara", "Bendahara / Kasir"],
      ["admin_anggota", "Admin Keanggotaan"],
      ["analis_kredit", "Analis Kredit"],
      ["kolektor", "Kolektor"],
      ["auditor", "Auditor"],
    ] as const;

    for (const [slug, name] of tenantTemplates) {
      await upsertRole(slug, name, "TENANT", null, ROLE_PERMISSION_MAP[slug] ?? []);
    }

    const email = (process.env.PLATFORM_ADMIN_EMAIL ?? "admin@mankopi.local").toLowerCase();
    const password = process.env.PLATFORM_ADMIN_PASSWORD ?? "ChangeMeNow!23";
    let admin = await tx.user.findUnique({ where: { email } });
    if (!admin) {
      admin = await tx.user.create({
        data: {
          email,
          name: "Platform Operator",
          passwordHash: await bcrypt.hash(password, 10),
          memberships: { create: { roleId: platformRole.id, scope: "PLATFORM" } },
        },
      });
    }

    if (process.env.SEED_DEMO_TENANT === "true") {
      let tenant = await tx.tenant.findUnique({ where: { slug: "sejahtera" } });
      if (!tenant) {
        tenant = await tx.tenant.create({
          data: {
            slug: "sejahtera",
            name: "Koperasi Sejahtera",
            legalName: "KSP Sejahtera Mandiri",
            status: "ACTIVE",
            settings: { requirePokokForLoan: true, requireWajibForLoan: false },
            branches: { create: { code: "HQ", name: "Kantor Pusat" } },
          },
        });
      }
      for (const [slug, name] of tenantTemplates) {
        await upsertRole(slug, name, "TENANT", tenant.id, ROLE_PERMISSION_MAP[slug] ?? []);
      }
      const ketua = await tx.role.findFirst({ where: { tenantId: tenant.id, slug: "ketua" } });
      const ketuaEmail = "ketua@sejahtera.local";
      const exists = await tx.user.findUnique({ where: { email: ketuaEmail } });
      if (!exists && ketua) {
        await tx.user.create({
          data: {
            email: ketuaEmail,
            name: "Ketua Sejahtera",
            tenantId: tenant.id,
            passwordHash: await bcrypt.hash(password, 10),
            memberships: {
              create: { roleId: ketua.id, tenantId: tenant.id, scope: "TENANT" },
            },
          },
        });
      }
      const existingAccounts = await tx.account.findMany({ where: { tenantId: tenant.id }, select: { code: true } });
      const haveCodes = new Set(existingAccounts.map((a) => a.code));
      const missingAccounts = DEFAULT_COA_TEMPLATE.filter((a) => !haveCodes.has(a.code));
      if (missingAccounts.length) {
        await tx.account.createMany({
          data: missingAccounts.map((a) => ({
            tenantId: tenant.id,
            code: a.code,
            name: a.name,
            classCode: a.classCode,
            normalBalance: a.normalBalance,
            isCash: a.isCash,
            report: a.report,
            cashFlow: a.cashFlow,
            ojkMap: a.ojkMap,
            isSystem: true,
          })),
        });
      }
      for (const a of DEFAULT_COA_TEMPLATE) {
        if (!a.cashFlow) continue;
        await tx.account.updateMany({
          where: { tenantId: tenant.id, code: a.code },
          data: { cashFlow: a.cashFlow, ojkMap: a.ojkMap },
        });
      }
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth() + 1;
      const period = await tx.accountingPeriod.findUnique({
        where: { tenantId_year_month: { tenantId: tenant.id, year, month } },
      });
      if (!period) {
        const startsOn = new Date(Date.UTC(year, month - 1, 1));
        const endsOn = new Date(Date.UTC(year, month, 0));
        await tx.accountingPeriod.create({
          data: { tenantId: tenant.id, year, month, startsOn, endsOn, status: "OPEN" },
        });
      }
      if ((await tx.savingProduct.count({ where: { tenantId: tenant.id } })) === 0) {
        await tx.savingProduct.createMany({
          data: [
            { tenantId: tenant.id, code: "POKOK", name: "Simpanan Pokok", kind: "POKOK", accountCode: "3101", minAmount: 100000, withdrawable: false, openOnJoin: true },
            { tenantId: tenant.id, code: "WAJIB", name: "Simpanan Wajib", kind: "WAJIB", accountCode: "3102", minAmount: 25000, withdrawable: false, openOnJoin: true },
            { tenantId: tenant.id, code: "SUKARELA", name: "Simpanan Sukarela", kind: "SUKARELA", accountCode: "2101", minAmount: 0, withdrawable: true, openOnJoin: true },
          ],
        });
      }
      if ((await tx.loanProduct.count({ where: { tenantId: tenant.id } })) === 0) {
        await tx.loanProduct.create({
          data: {
            tenantId: tenant.id,
            code: "REGULER",
            name: "Pinjaman Reguler",
            method: "DECLINING",
            frequency: "MONTHLY",
            rateBasis: "ANNUAL",
            annualRate: 0.18,
            periods: 12,
            graceDays: 3,
            penaltyKind: "NONE",
            penaltyValue: 0,
            minPrincipal: 500000,
            maxPrincipal: 25000000,
          },
        });
      }
      if ((await tx.expenseBudgetPolicy.count({ where: { tenantId: tenant.id } })) === 0) {
        await tx.expenseBudgetPolicy.createMany({
          data: DEFAULT_EXPENSE_BUDGETS.map((row) => ({
            tenantId: tenant.id,
            accountCode: row.accountCode,
            name: row.name,
            percent: row.percent,
          })),
        });
      }
      if ((await tx.ckpnRate.count({ where: { tenantId: tenant.id } })) === 0) {
        await tx.ckpnRate.createMany({
          data: DEFAULT_CKPN_RATES.map((row) => ({ tenantId: tenant.id, grade: row.grade, percent: row.percent })),
        });
      }
      if ((await tx.shuSharePolicy.count({ where: { tenantId: tenant.id } })) === 0) {
        await tx.shuSharePolicy.createMany({
          data: DEFAULT_SHU_SHARES.map((row) => ({
            tenantId: tenant.id,
            accountCode: row.accountCode,
            name: row.name,
            percent: row.percent,
            sortOrder: row.sortOrder,
          })),
        });
      }
      if ((await tx.tenantHoliday.count({ where: { tenantId: tenant.id } })) === 0) {
        await tx.tenantHoliday.createMany({
          data: INDONESIA_NATIONAL_HOLIDAYS_2026.map((h) => ({
            tenantId: tenant.id,
            date: new Date(`${h.date}T00:00:00Z`),
            name: h.name,
            source: h.source,
            enabled: h.enabled,
          })),
        });
      }
    }

    console.log(`Seed selesai. Platform: ${email}`);
  });
}

seedInTx()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
