import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { INDONESIA_NATIONAL_HOLIDAYS_2026, computePenalty, generateSchedule, gradeCollectability, nextPenaltyDue, spreadPayment } from "@mankopi/loan-engine";
import { ERROR_CODES, INSTALLMENT_FREQUENCIES, INTEREST_METHODS, PENALTY_KINDS, RATE_BASES } from "@mankopi/shared";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { LedgerService } from "../ledger/ledger.service";
import {
  changeLoanTermsError,
  changeSavingAccountError,
  deactivateMembershipError,
  loanBoundError,
  loanLimitError,
  membershipPaidError,
  parseTenantPolicy,
  loanStatusChangeError,
  normalizeProductCode,
  parseSavingKind,
  productCodeError,
  productNameError,
  savingAccountMapError,
  savingDepositError,
  savingMinAmountError,
  savingWithdrawError,
  uniqueMembershipError,
} from "./product-policy";
import {
  loanDecisionAuditAction,
  loanDecisionError,
  loanStatusFromDecision,
  type LoanDecisionKind,
} from "./loan-decision";
import { formatSavingAccountNo, withSavingRunningBalance } from "./saving-ledger";
import { formatSavingTxnNo, parseSavingMethod, savingMethodError, savingMethodLabel, savingNoteError, savingTransferError } from "./saving-txn";
import {
  formatMemberAddress,
  memberProfileError,
  toDate,
  toMemberWrite,
  type MemberProfileInput,
} from "./member-profile";
import { memberExitError, memberRestoreError } from "./member-exit";
import { memberListWhere, parseMemberPage, parseMemberPageSize } from "./member-query";

function n(v: Prisma.Decimal | number | string | null | undefined) {
  return Number(v ?? 0);
}

function reject(message: string | null): asserts message is null {
  if (message) throw new BadRequestException({ message });
}

function asSettings(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
}

function mergeTenantSettings(raw: unknown, patch: { requirePokokForLoan?: boolean; requireWajibForLoan?: boolean } = {}) {
  return { ...asSettings(raw), ...parseTenantPolicy(raw), ...patch };
}

function parseReceiptAlloc(raw: unknown) {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const items = Array.isArray(value.items)
    ? value.items.flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const item = row as Record<string, unknown>;
        if (typeof item.id !== "string" && typeof item.scheduleItemId !== "string") return [];
        return [
          {
            id: String(item.id ?? item.scheduleItemId),
            principal: Number(item.principal ?? 0),
            interest: Number(item.interest ?? 0),
            penalty: Number(item.penalty ?? 0),
          },
        ];
      })
    : [];
  return {
    principal: Number(value.principal ?? 0),
    interest: Number(value.interest ?? 0),
    penalty: Number(value.penalty ?? 0),
    leftover: Number(value.leftover ?? 0),
    scheduleItemId: typeof value.scheduleItemId === "string" ? value.scheduleItemId : undefined,
    items,
  };
}

const SAVING_DEFAULTS = [
  { code: "POKOK", name: "Simpanan Pokok", kind: "POKOK", accountCode: "3101", minAmount: 100000, withdrawable: false, openOnJoin: true },
  { code: "WAJIB", name: "Simpanan Wajib", kind: "WAJIB", accountCode: "3102", minAmount: 25000, withdrawable: false, openOnJoin: true },
  { code: "SUKARELA", name: "Simpanan Sukarela", kind: "SUKARELA", accountCode: "2101", minAmount: 0, withdrawable: true, openOnJoin: true },
];

@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  async provisionMaster(tenantId: string) {
    await this.ledger.provision(tenantId);
    await this.provision(tenantId);
    await this.ensurePolicy(tenantId);
  }

  async setupSnapshot(tenantId: string) {
    const now = new Date();
    const [accounts, period, savings, loans, holidays, tenant, cashAccounts, opening] = await Promise.all([
      this.prisma.db.account.count({ where: { tenantId } }),
      this.prisma.db.accountingPeriod.findUnique({
        where: { tenantId_year_month: { tenantId, year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 } },
      }),
      this.prisma.db.savingProduct.findMany({ where: { tenantId }, orderBy: { code: "asc" } }),
      this.prisma.db.loanProduct.count({ where: { tenantId, status: "ACTIVE" } }),
      this.prisma.db.tenantHoliday.count({ where: { tenantId, enabled: true } }),
      this.prisma.db.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } }),
      this.prisma.db.account.findMany({
        where: { tenantId, isCash: true, status: "ACTIVE" },
        select: { code: true, name: true },
        orderBy: { code: "asc" },
      }),
      this.prisma.db.journalEntry.findMany({
        where: { tenantId, sourceType: "opening.capital", status: "POSTED" },
        select: { creditTotal: true },
      }),
    ]);
    const openingCapital = opening.reduce((sum, row) => sum + n(row.creditTotal), 0);
    return {
      policy: parseTenantPolicy(tenant?.settings),
      cashAccounts,
      ready: {
        accounts,
        openPeriod: period?.status === "OPEN",
        openingCapital,
        savingProducts: savings.length,
        withdrawableProducts: savings.filter((p) => p.withdrawable && p.status === "ACTIVE").length,
        loanProducts: loans,
        holidays,
      },
    };
  }

  async postOpeningCapital(
    tenantId: string,
    input: { amount: number; cashCode?: string; postedOn?: string; memo?: string },
    actorId?: string,
  ) {
    const amount = Number(input.amount);
    if (!(amount > 0)) throw new BadRequestException({ message: "Nominal modal harus lebih dari 0" });
    await this.ledger.provision(tenantId);
    const cash = await this.ledger.accountByCode(tenantId, input.cashCode ?? "1101");
    if (!cash.isCash) throw new BadRequestException({ message: "Pilih Kas atau Bank sebagai tempat uang masuk" });
    const equity = await this.ledger.accountByCode(tenantId, "3103");
    const journal = await this.ledger.postFromSource(
      tenantId,
      {
        postedOn: input.postedOn ?? new Date().toISOString().slice(0, 10),
        memo: input.memo?.trim() || "Modal awal koperasi",
        sourceType: "opening.capital",
        sourceId: tenantId,
        lines: [
          { accountId: cash.id, debit: amount, credit: 0 },
          { accountId: equity.id, debit: 0, credit: amount },
        ],
      },
      actorId,
    );
    await this.audit.record({ action: "ledger.opening_capital.posted", resource: "journal", resourceId: journal.id, tenantId, actorId });
    return journal;
  }

  async savePolicy(tenantId: string, input: { requirePokokForLoan?: boolean; requireWajibForLoan?: boolean }, actorId?: string) {
    const tenant = await this.prisma.db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException({ message: "Koperasi tidak ditemukan" });
    const next = mergeTenantSettings(tenant.settings, input);
    await this.prisma.db.tenant.update({ where: { id: tenantId }, data: { settings: next } });
    await this.audit.record({ action: "org.policy.updated", resource: "tenant", resourceId: tenantId, tenantId, actorId });
    return parseTenantPolicy(next);
  }

  private async ensurePolicy(tenantId: string) {
    const tenant = await this.prisma.db.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    if (!tenant) return;
    await this.prisma.db.tenant.update({ where: { id: tenantId }, data: { settings: mergeTenantSettings(tenant.settings) } });
  }

  async provision(tenantId: string) {
    if ((await this.prisma.db.savingProduct.count({ where: { tenantId } })) === 0) {
      await this.prisma.db.savingProduct.createMany({ data: SAVING_DEFAULTS.map((p) => ({ tenantId, ...p })) });
    }
    if ((await this.prisma.db.loanProduct.count({ where: { tenantId } })) === 0) {
      await this.prisma.db.loanProduct.create({
        data: {
          tenantId,
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
    if ((await this.prisma.db.tenantHoliday.count({ where: { tenantId } })) === 0) {
      await this.prisma.db.tenantHoliday.createMany({
        data: INDONESIA_NATIONAL_HOLIDAYS_2026.map((h) => ({
          tenantId,
          date: new Date(`${h.date}T00:00:00Z`),
          name: h.name,
          source: h.source,
          enabled: h.enabled,
        })),
      });
    }
  }

  listMembers(tenantId: string, input: { q?: string; status?: string; page?: string; pageSize?: string } = {}) {
    const page = parseMemberPage(input.page);
    const pageSize = parseMemberPageSize(input.pageSize);
    const where = memberListWhere(tenantId, input.q, input.status);
    return Promise.all([
      this.prisma.db.member.findMany({
        where,
        orderBy: [{ name: "asc" }, { memberNo: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          savingAccounts: { include: { product: true }, orderBy: { accountNo: "asc" } },
          loans: { select: { id: true, loanNo: true, status: true } },
          branch: { select: { id: true, code: true, name: true } },
          unit: { select: { id: true, code: true, name: true, branchId: true } },
        },
      }),
      this.prisma.db.member.count({ where }),
    ]).then(([items, total]) => ({ items, total, page, pageSize }));
  }

  private async resolveOffice(tenantId: string, branchId?: string, unitId?: string | null) {
    let branch = branchId
      ? await this.prisma.db.branch.findFirst({ where: { id: branchId, tenantId } })
      : null;
    if (!branch && unitId) {
      const unit = await this.prisma.db.unit.findFirst({ where: { id: unitId, tenantId }, include: { branch: true } });
      if (unit) branch = unit.branch;
    }
    if (!branch) {
      branch =
        (await this.prisma.db.branch.findFirst({ where: { tenantId, status: "ACTIVE", code: "HQ" } })) ??
        (await this.prisma.db.branch.findFirst({ where: { tenantId, status: "ACTIVE" }, orderBy: { createdAt: "asc" } }));
    }
    if (!branch) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: "Belum ada cabang aktif. Buat cabang di menu Cabang dulu.",
      });
    }
    if (!unitId) return { branchId: branch.id, unitId: null as string | null };
    const unit = await this.prisma.db.unit.findFirst({
      where: { id: unitId, tenantId, branchId: branch.id },
    });
    if (!unit) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_FAILED,
        message: "Unit tidak termasuk cabang yang dipilih",
      });
    }
    return { branchId: branch.id, unitId: unit.id };
  }

  async createMember(tenantId: string, input: MemberProfileInput, actorId?: string) {
    reject(memberProfileError(input, "create"));
    const nik = input.nik!.trim();
    const exists = await this.prisma.db.member.findUnique({ where: { tenantId_nik: { tenantId, nik } } });
    if (exists) throw new ConflictException({ code: ERROR_CODES.CONFLICT, message: "NIK sudah terdaftar" });
    const seq = (await this.prisma.db.member.count({ where: { tenantId } })) + 1;
    const office = await this.resolveOffice(tenantId, input.branchId, input.unitId);
    const profile = toMemberWrite(input);
    const member = await this.prisma.db.member.create({
      data: {
        tenantId,
        memberNo: `AGT-${String(seq).padStart(4, "0")}`,
        nik,
        ...profile,
        name: profile.name ?? input.name!.trim(),
        joinedOn: profile.joinedOn ?? new Date(),
        slikConsentAt: input.slikConsent ? new Date() : undefined,
        branchId: office.branchId,
        unitId: office.unitId,
      },
    });
    const products = await this.prisma.db.savingProduct.findMany({ where: { tenantId, status: "ACTIVE", openOnJoin: true } });
    if (products.length) {
      const used = await this.prisma.db.savingAccount.count({ where: { tenantId } });
      await this.prisma.db.savingAccount.createMany({
        data: products.map((p, index) => ({
          tenantId,
          memberId: member.id,
          productId: p.id,
          accountNo: formatSavingAccountNo(used + index + 1),
        })),
      });
    }
    await this.audit.record({ action: "membership.member.registered", resource: "member", resourceId: member.id, tenantId, actorId });
    return this.prisma.db.member.findUnique({
      where: { id: member.id },
      include: {
        savingAccounts: { include: { product: true }, orderBy: { accountNo: "asc" } },
        loans: true,
        branch: { select: { id: true, code: true, name: true } },
        unit: { select: { id: true, code: true, name: true, branchId: true } },
      },
    });
  }

  async updateMember(tenantId: string, memberId: string, input: MemberProfileInput, actorId?: string) {
    reject(memberProfileError(input, "update"));
    const member = await this.prisma.db.member.findFirst({ where: { id: memberId, tenantId } });
    if (!member) throw new NotFoundException({ message: "Anggota tidak ditemukan" });
    const office =
      input.branchId !== undefined || input.unitId !== undefined
        ? await this.resolveOffice(tenantId, input.branchId ?? member.branchId ?? undefined, input.unitId)
        : { branchId: member.branchId, unitId: member.unitId };
    const profile = toMemberWrite(input);
    const updated = await this.prisma.db.member.update({
      where: { id: member.id },
      data: {
        ...profile,
        slikConsentAt: input.slikConsent ? member.slikConsentAt ?? new Date() : member.slikConsentAt,
        branchId: office.branchId,
        unitId: office.unitId,
      },
      include: {
        savingAccounts: { include: { product: true }, orderBy: { accountNo: "asc" } },
        loans: true,
        branch: { select: { id: true, code: true, name: true } },
        unit: { select: { id: true, code: true, name: true, branchId: true } },
      },
    });
    await this.audit.record({ action: "membership.member.updated", resource: "member", resourceId: member.id, tenantId, actorId });
    return updated;
  }

  private memberDetail(id: string) {
    return this.prisma.db.member.findUnique({
      where: { id },
      include: {
        savingAccounts: { include: { product: true }, orderBy: { accountNo: "asc" } },
        loans: true,
        branch: { select: { id: true, code: true, name: true } },
        unit: { select: { id: true, code: true, name: true, branchId: true } },
      },
    });
  }

  async leaveMember(tenantId: string, memberId: string, input: { reason?: string; leftOn?: string }, actorId?: string) {
    const member = await this.prisma.db.member.findFirst({
      where: { id: memberId, tenantId },
      include: { loans: { select: { status: true } } },
    });
    if (!member) throw new NotFoundException({ message: "Anggota tidak ditemukan" });
    const reason = (input.reason ?? "").trim();
    reject(memberExitError({ status: member.status, loans: member.loans, reason, leftOn: input.leftOn }));
    await this.prisma.db.member.update({
      where: { id: member.id },
      data: {
        status: "LEFT",
        leftOn: toDate(input.leftOn) ?? new Date(),
        exitReason: reason,
      },
    });
    await this.audit.record({
      action: "membership.member.left",
      resource: "member",
      resourceId: member.id,
      tenantId,
      actorId,
      metadata: { reason },
    });
    return this.memberDetail(member.id);
  }

  async restoreMember(tenantId: string, memberId: string, actorId?: string) {
    const member = await this.prisma.db.member.findFirst({ where: { id: memberId, tenantId } });
    if (!member) throw new NotFoundException({ message: "Anggota tidak ditemukan" });
    reject(memberRestoreError(member.status));
    await this.prisma.db.member.update({
      where: { id: member.id },
      data: { status: "ACTIVE", leftOn: null, exitReason: null },
    });
    await this.audit.record({ action: "membership.member.restored", resource: "member", resourceId: member.id, tenantId, actorId });
    return this.memberDetail(member.id);
  }

  async listSavingProducts(tenantId: string) {
    const rows = await this.prisma.db.savingProduct.findMany({
      where: { tenantId },
      orderBy: { code: "asc" },
      include: { _count: { select: { accounts: true } }, accounts: { select: { id: true, _count: { select: { txns: true } } } } },
    });
    return rows.map(({ accounts, ...row }) => ({
      ...row,
      hasMovements: accounts.some((a) => a._count.txns > 0),
    }));
  }

  async createSavingProduct(
    tenantId: string,
    input: { code: string; name: string; kind: string; accountCode: string; minAmount?: number; withdrawable?: boolean; openOnJoin?: boolean },
    actorId?: string,
  ) {
    const code = normalizeProductCode(input.code);
    const kind = parseSavingKind(input.kind);
    if (!kind) throw new BadRequestException({ message: "Jenis produk harus pokok, wajib, atau sukarela" });
    reject(productCodeError(code));
    reject(productNameError(input.name));
    reject(savingMinAmountError(kind, input.minAmount ?? 0));
    const account = await this.ledger.accountByCode(tenantId, input.accountCode);
    reject(savingAccountMapError(kind, account.classCode));
    const dup = await this.prisma.db.savingProduct.findUnique({ where: { tenantId_code: { tenantId, code } } });
    if (dup) throw new ConflictException({ code: ERROR_CODES.CONFLICT, message: "Kode produk sudah dipakai" });
    const activeSameKind = await this.prisma.db.savingProduct.count({ where: { tenantId, kind, status: "ACTIVE" } });
    reject(uniqueMembershipError(kind, activeSameKind));
    const product = await this.prisma.db.savingProduct.create({
      data: {
        tenantId,
        code,
        name: input.name.trim(),
        kind,
        accountCode: input.accountCode,
        minAmount: input.minAmount ?? 0,
        withdrawable: input.withdrawable ?? kind === "SUKARELA",
        openOnJoin: input.openOnJoin ?? true,
      },
    });
    if (product.openOnJoin) await this.openSavingAccounts(tenantId, product.id);
    await this.audit.record({ action: "savings.product.created", resource: "saving_product", resourceId: product.id, tenantId, actorId });
    return product;
  }

  async updateSavingProduct(
    tenantId: string,
    id: string,
    input: { name?: string; minAmount?: number; status?: string; accountCode?: string; withdrawable?: boolean; openOnJoin?: boolean },
    actorId?: string,
  ) {
    const existing = await this.prisma.db.savingProduct.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException({ message: "Produk simpanan tidak ditemukan" });
    const kind = parseSavingKind(existing.kind) ?? "SUKARELA";
    if (input.name) reject(productNameError(input.name));
    if (input.minAmount != null) reject(savingMinAmountError(kind, input.minAmount));
    reject(loanStatusChangeError(input.status));
    if (input.status === "INACTIVE") {
      const others = await this.prisma.db.savingProduct.count({
        where: { tenantId, kind: existing.kind, status: "ACTIVE", id: { not: id } },
      });
      reject(deactivateMembershipError(existing.kind, others));
    }
    if (input.accountCode && input.accountCode !== existing.accountCode) {
      const movements = await this.prisma.db.savingTxn.count({ where: { account: { productId: id } } });
      reject(changeSavingAccountError(movements > 0));
      const account = await this.ledger.accountByCode(tenantId, input.accountCode);
      reject(savingAccountMapError(kind, account.classCode));
    }
    const product = await this.prisma.db.savingProduct.update({
      where: { id },
      data: {
        name: input.name?.trim() || undefined,
        minAmount: input.minAmount,
        status: input.status,
        accountCode: input.accountCode,
        withdrawable: input.withdrawable,
        openOnJoin: input.openOnJoin,
      },
    });
    if (product.status === "ACTIVE" && product.openOnJoin) await this.openSavingAccounts(tenantId, product.id);
    await this.audit.record({ action: "savings.product.updated", resource: "saving_product", resourceId: product.id, tenantId, actorId });
    return product;
  }

  private async openSavingAccounts(tenantId: string, productId: string) {
    const members = await this.prisma.db.member.findMany({ where: { tenantId, status: "ACTIVE" }, select: { id: true } });
    if (!members.length) return;
    const existing = await this.prisma.db.savingAccount.findMany({
      where: { tenantId, productId },
      select: { memberId: true },
    });
    const have = new Set(existing.map((row) => row.memberId));
    const missing = members.filter((m) => !have.has(m.id));
    if (!missing.length) return;
    const used = await this.prisma.db.savingAccount.count({ where: { tenantId } });
    await this.prisma.db.savingAccount.createMany({
      data: missing.map((m, index) => ({
        tenantId,
        memberId: m.id,
        productId,
        accountNo: formatSavingAccountNo(used + index + 1),
      })),
    });
  }

  listSavingAccounts(tenantId: string) {
    return this.prisma.db.savingAccount.findMany({
      where: { tenantId },
      orderBy: { accountNo: "asc" },
      include: {
        member: { select: { id: true, memberNo: true, name: true, phone: true, status: true } },
        product: true,
        _count: { select: { txns: true } },
      },
    });
  }

  async getSavingAccount(tenantId: string, idOrNo: string) {
    const account = await this.prisma.db.savingAccount.findFirst({
      where: { tenantId, OR: [{ id: idOrNo }, { accountNo: idOrNo }] },
      include: {
        member: { select: { id: true, memberNo: true, name: true, phone: true, status: true } },
        product: true,
      },
    });
    if (!account) throw new NotFoundException({ message: "Rekening simpanan tidak ditemukan" });
    const txns = await this.prisma.db.savingTxn.findMany({
      where: { tenantId, accountId: account.id },
      orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }],
    });
    const journalIds = txns.map((row) => row.journalId).filter((id): id is string => Boolean(id));
    const journals = journalIds.length
      ? await this.prisma.db.journalEntry.findMany({
          where: { tenantId, id: { in: journalIds } },
          select: { id: true, number: true, memo: true, status: true },
        })
      : [];
    const journalById = new Map(journals.map((row) => [row.id, row]));
    const chronological = withSavingRunningBalance(
      txns.map((row) => {
        const journal = row.journalId ? journalById.get(row.journalId) : undefined;
        return {
          id: row.id,
          txnNo: row.txnNo,
          type: row.type,
          method: row.method,
          amount: n(row.amount),
          occurredOn: row.occurredOn,
          createdAt: row.createdAt,
          journalId: row.journalId,
          journalNo: journal?.number ?? null,
          memo: row.note ?? journal?.memo ?? null,
          note: row.note,
          methodLabel: savingMethodLabel(row.method),
        };
      }),
    );
    const ledger = chronological.slice().reverse();
    const totalSetor = txns.filter((row) => row.type === "SETOR").reduce((sum, row) => sum + n(row.amount), 0);
    const totalTarik = txns.filter((row) => row.type === "TARIK").reduce((sum, row) => sum + n(row.amount), 0);
    return {
      id: account.id,
      accountNo: account.accountNo,
      balance: n(account.balance),
      status: account.status,
      openedOn: account.createdAt,
      member: account.member,
      product: account.product,
      summary: {
        txnCount: txns.length,
        totalSetor,
        totalTarik,
      },
      ledger,
    };
  }

  async mutateSaving(
    tenantId: string,
    input: {
      accountId: string;
      type: "SETOR" | "TARIK";
      amount: number;
      occurredOn?: string;
      method?: string;
      note?: string;
      counterAccountId?: string;
    },
    actorId?: string,
  ) {
    reject(savingMethodError(input.method));
    reject(savingNoteError(input.note));
    const method = parseSavingMethod(input.method) ?? "CASH";
    reject(savingTransferError(method, input.accountId, input.counterAccountId));
    if (input.type !== "SETOR" && input.type !== "TARIK") {
      throw new BadRequestException({ message: "Jenis mutasi harus setor atau tarik" });
    }

    const account = await this.prisma.db.savingAccount.findFirst({
      where: { id: input.accountId, tenantId },
      include: { product: true, member: true, tenant: { select: { name: true, legalName: true } } },
    });
    if (!account) throw new NotFoundException({ message: "Rekening simpanan tidak ditemukan" });
    if (account.member.status === "LEFT" && input.type === "SETOR") {
      throw new ConflictException({ message: "Anggota sudah berhenti. Setoran baru tidak diterima." });
    }

    const amount = Number(input.amount);
    const kind = parseSavingKind(account.product.kind);
    if (!kind) throw new BadRequestException({ message: "Jenis produk simpanan tidak valid" });
    if (input.type === "TARIK") {
      reject(savingWithdrawError(account.product.withdrawable, n(account.balance), amount));
    } else {
      reject(savingDepositError(kind, n(account.product.minAmount), n(account.balance), amount));
    }

    const counter =
      method === "TRANSFER"
        ? await this.prisma.db.savingAccount.findFirst({
            where: { id: input.counterAccountId, tenantId },
            include: { product: true, member: true },
          })
        : null;
    if (method === "TRANSFER" && !counter) throw new NotFoundException({ message: "Rekening sumber atau tujuan tidak ditemukan" });

    const source = input.type === "SETOR" && counter ? counter : account;
    const dest = input.type === "SETOR" && counter ? account : counter;
    if (method === "TRANSFER" && dest) {
      if (dest.member.status === "LEFT") {
        throw new ConflictException({ message: "Rekening tujuan milik anggota yang sudah berhenti." });
      }
      const destKind = parseSavingKind(dest.product.kind);
      if (!destKind) throw new BadRequestException({ message: "Jenis produk rekening tujuan tidak valid" });
      if (input.type === "TARIK") {
        reject(savingDepositError(destKind, n(dest.product.minAmount), n(dest.balance), amount));
      }
      if (input.type === "SETOR") {
        reject(savingWithdrawError(source.product.withdrawable, n(source.balance), amount));
      }
    }

    const note = input.note?.trim() || null;
    const occurredOn = input.occurredOn ?? new Date().toISOString().slice(0, 10);
    const methodText = savingMethodLabel(method);
    const actionLabel = input.type === "SETOR" ? "Setor" : "Tarik";
    const memo = [actionLabel, account.product.name, account.member.memberNo, methodText, note].filter(Boolean).join(" · ");
    const contra = await this.ledger.accountByCode(tenantId, account.product.accountCode);
    const lines =
      method === "TRANSFER" && counter
        ? input.type === "SETOR"
          ? [
              { accountId: (await this.ledger.accountByCode(tenantId, source.product.accountCode)).id, debit: amount, credit: 0 },
              { accountId: contra.id, debit: 0, credit: amount },
            ]
          : [
              { accountId: contra.id, debit: amount, credit: 0 },
              { accountId: (await this.ledger.accountByCode(tenantId, dest!.product.accountCode)).id, debit: 0, credit: amount },
            ]
        : input.type === "SETOR"
          ? [
              { accountId: (await this.ledger.accountByCode(tenantId, method === "BANK" ? "1102" : "1101")).id, debit: amount, credit: 0 },
              { accountId: contra.id, debit: 0, credit: amount },
            ]
          : [
              { accountId: contra.id, debit: amount, credit: 0 },
              { accountId: (await this.ledger.accountByCode(tenantId, method === "BANK" ? "1102" : "1101")).id, debit: 0, credit: amount },
            ];

    const journal = await this.ledger.postFromSource(
      tenantId,
      {
        postedOn: occurredOn,
        memo,
        sourceType: method === "TRANSFER" ? "savings.transfer" : input.type === "SETOR" ? "savings.deposit" : "savings.withdraw",
        sourceId: account.id,
        lines,
      },
      actorId,
    );

    const nextPrimary = n(account.balance) + (input.type === "SETOR" ? amount : -amount);
    await this.prisma.db.savingAccount.update({ where: { id: account.id }, data: { balance: nextPrimary } });
    if (counter) {
      const nextCounter = n(counter.balance) + (input.type === "SETOR" ? -amount : amount);
      await this.prisma.db.savingAccount.update({ where: { id: counter.id }, data: { balance: nextCounter } });
    }

    const used = await this.prisma.db.savingTxn.count({ where: { tenantId } });
    const occurred = new Date(`${occurredOn}T00:00:00Z`);
    const txn = await this.prisma.db.savingTxn.create({
      data: {
        tenantId,
        accountId: account.id,
        txnNo: formatSavingTxnNo(used + 1),
        type: input.type,
        amount,
        method,
        note,
        counterAccountId: counter?.id ?? null,
        journalId: journal.id,
        occurredOn: occurred,
      },
    });
    if (counter) {
      await this.prisma.db.savingTxn.create({
        data: {
          tenantId,
          accountId: counter.id,
          txnNo: formatSavingTxnNo(used + 2),
          type: input.type === "SETOR" ? "TARIK" : "SETOR",
          amount,
          method: "TRANSFER",
          note,
          counterAccountId: account.id,
          journalId: journal.id,
          occurredOn: occurred,
        },
      });
    }
    await this.audit.record({ action: "savings.transaction.posted", resource: "saving_txn", resourceId: txn.id, tenantId, actorId });
    return this.savingVoucher(tenantId, txn.id);
  }

  async getSavingTxn(tenantId: string, id: string) {
    return this.savingVoucher(tenantId, id);
  }

  private async savingVoucher(tenantId: string, id: string) {
    const txn = await this.prisma.db.savingTxn.findFirst({
      where: { id, tenantId },
      include: {
        account: {
          include: {
            member: { select: { name: true, memberNo: true, phone: true } },
            product: true,
            tenant: { select: { name: true, legalName: true } },
          },
        },
      },
    });
    if (!txn) throw new NotFoundException({ message: "Bukti transaksi simpanan tidak ditemukan" });
    const journal = txn.journalId
      ? await this.prisma.db.journalEntry.findFirst({ where: { id: txn.journalId, tenantId }, select: { number: true } })
      : null;
    const counter = txn.counterAccountId
      ? await this.prisma.db.savingAccount.findFirst({
          where: { id: txn.counterAccountId, tenantId },
          include: { member: { select: { name: true, memberNo: true } }, product: true },
        })
      : null;
    const history = await this.prisma.db.savingTxn.findMany({
      where: { tenantId, accountId: txn.accountId },
      orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }],
      select: { id: true, type: true, amount: true },
    });
    const running = withSavingRunningBalance(history.map((row) => ({ id: row.id, type: row.type, amount: n(row.amount) })));
    const balanceAfter = running.find((row) => row.id === txn.id)?.balanceAfter ?? n(txn.account.balance);
    return {
      id: txn.id,
      txnNo: txn.txnNo,
      type: txn.type,
      method: txn.method,
      methodLabel: savingMethodLabel(txn.method),
      amount: n(txn.amount),
      note: txn.note,
      occurredOn: txn.occurredOn,
      journalNo: journal?.number ?? null,
      balanceAfter,
      account: {
        id: txn.account.id,
        accountNo: txn.account.accountNo,
        productName: txn.account.product.name,
        productKind: txn.account.product.kind,
      },
      member: txn.account.member,
      tenant: txn.account.tenant,
      counter: counter
        ? {
            accountNo: counter.accountNo,
            memberNo: counter.member.memberNo,
            memberName: counter.member.name,
            productName: counter.product.name,
          }
        : null,
    };
  }

  listLoans(tenantId: string) {
    return this.prisma.db.loan.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        member: true,
        product: true,
        schedule: { orderBy: { sequence: "asc" } },
        decidedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async getLoanReview(tenantId: string, loanId: string) {
    const loan = await this.prisma.db.loan.findFirst({
      where: { id: loanId, tenantId },
      include: {
        product: true,
        schedule: { orderBy: { sequence: "asc" } },
        decidedBy: { select: { id: true, name: true, email: true } },
        member: {
          include: {
            branch: { select: { id: true, code: true, name: true } },
            unit: { select: { id: true, code: true, name: true } },
            savingAccounts: { include: { product: true }, orderBy: { accountNo: "asc" } },
            loans: { orderBy: { createdAt: "desc" }, include: { product: { select: { name: true, code: true } } } },
          },
        },
      },
    });
    if (!loan) throw new NotFoundException({ message: "Pinjaman tidak ditemukan" });

    const tenant = await this.prisma.db.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    const policy = parseTenantPolicy(tenant?.settings);
    const others = loan.member.loans.filter((row) => row.id !== loan.id);
    const savings = loan.member.savingAccounts.map((account) => ({
      id: account.id,
      accountNo: account.accountNo,
      kind: account.product.kind,
      name: account.product.name,
      balance: n(account.balance),
      minAmount: n(account.product.minAmount),
    }));
    const savingsTotal = savings.reduce((sum, row) => sum + row.balance, 0);
    const pokok = savings.find((row) => row.kind === "POKOK");
    const wajib = savings.find((row) => row.kind === "WAJIB");
    const history = {
      loanCount: others.length,
      disbursedTotal: others
        .filter((row) => row.status === "DISBURSED" || row.status === "CLOSED")
        .reduce((sum, row) => sum + n(row.principal), 0),
      activeCount: others.filter((row) => row.status === "DISBURSED").length,
      activeOutstanding: others
        .filter((row) => row.status === "DISBURSED")
        .reduce((sum, row) => sum + n(row.outstandingPrincipal), 0),
      lancarCount: others.filter((row) => row.status === "DISBURSED" && row.collectability === 1).length,
      lancarOutstanding: others
        .filter((row) => row.status === "DISBURSED" && row.collectability === 1)
        .reduce((sum, row) => sum + n(row.outstandingPrincipal), 0),
      macetCount: others.filter((row) => row.collectability === 5 && (row.status === "DISBURSED" || row.status === "CLOSED")).length,
      macetOutstanding: others
        .filter((row) => row.collectability === 5 && row.status === "DISBURSED")
        .reduce((sum, row) => sum + n(row.outstandingPrincipal), 0),
      loans: others.map((row) => ({
        id: row.id,
        loanNo: row.loanNo,
        productName: row.product.name,
        principal: n(row.principal),
        outstanding: n(row.outstandingPrincipal),
        status: row.status,
        collectability: row.collectability,
        createdAt: row.createdAt,
      })),
    };

    const flags: Array<{ level: "ok" | "warn"; code: string; label: string }> = [];
    if (loan.member.status !== "ACTIVE") {
      flags.push({
        level: "warn",
        code: "member",
        label: loan.member.status === "LEFT" ? "Anggota sudah berhenti" : "Anggota tidak aktif",
      });
    } else {
      flags.push({ level: "ok", code: "member", label: "Anggota aktif" });
    }
    if (loan.member.slikConsentAt) {
      flags.push({ level: "ok", code: "slik", label: "Persetujuan SLIK tercatat" });
    } else {
      flags.push({ level: "warn", code: "slik", label: "Belum ada persetujuan SLIK" });
    }
    if (policy.requirePokokForLoan) {
      const paid = Boolean(pokok && pokok.balance >= pokok.minAmount);
      flags.push({
        level: paid ? "ok" : "warn",
        code: "pokok",
        label: paid ? "Simpanan pokok memenuhi syarat" : "Simpanan pokok belum memenuhi syarat AD/ART",
      });
    }
    if (policy.requireWajibForLoan) {
      const paid = Boolean(wajib && wajib.balance >= wajib.minAmount);
      flags.push({
        level: paid ? "ok" : "warn",
        code: "wajib",
        label: paid ? "Simpanan wajib memenuhi syarat" : "Simpanan wajib belum memenuhi syarat AD/ART",
      });
    }
    if (history.activeCount > 0) {
      flags.push({
        level: "warn",
        code: "active",
        label: `Masih ada ${history.activeCount} pinjaman berjalan · outstanding ${history.activeOutstanding.toLocaleString("id-ID")}`,
      });
    } else {
      flags.push({ level: "ok", code: "active", label: "Tidak ada pinjaman berjalan" });
    }
    if (history.macetCount > 0) {
      flags.push({ level: "warn", code: "macet", label: `Ada riwayat macet (${history.macetCount} rekening)` });
    } else {
      flags.push({ level: "ok", code: "macet", label: "Tidak ada riwayat macet" });
    }
    if (!loan.member.dateOfBirth || !loan.member.motherName || !loan.member.address) {
      flags.push({ level: "warn", code: "kyc", label: "Berkas identitas belum lengkap (TTL / ibu kandung / alamat)" });
    } else {
      flags.push({ level: "ok", code: "kyc", label: "Identitas dasar lengkap" });
    }
    if (!loan.member.occupation) {
      flags.push({ level: "warn", code: "job", label: "Pekerjaan belum tercatat" });
    } else {
      flags.push({ level: "ok", code: "job", label: `Pekerjaan: ${loan.member.occupation}` });
    }
    const principal = n(loan.principal);
    const coverage = principal > 0 ? savingsTotal / principal : 0;
    if (coverage < 0.1) {
      flags.push({ level: "warn", code: "coverage", label: "Saldo simpanan di bawah 10% pokok pengajuan" });
    } else {
      flags.push({
        level: "ok",
        code: "coverage",
        label: `Cakupan simpanan ${(coverage * 100).toFixed(0)}% dari pokok pengajuan`,
      });
    }

    const holidays = await this.prisma.db.tenantHoliday.findMany({ where: { tenantId, enabled: true } });
    const preview = generateSchedule({
      principal,
      annualRate: n(loan.annualRate),
      rateBasis: loan.rateBasis as "ANNUAL" | "DAILY" | "PRINCIPAL_TOTAL",
      periods: loan.periods,
      method: loan.method as "FLAT" | "DECLINING" | "ANNUITY" | "DAILY_EFFECTIVE",
      frequency: loan.frequency as "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY",
      startDate: new Date().toISOString().slice(0, 10),
      holidays: holidays.map((h) => ({
        date: h.date.toISOString().slice(0, 10),
        name: h.name,
        source: h.source as "NATIONAL" | "TENANT",
        enabled: h.enabled,
      })),
    });

    const dob = loan.member.dateOfBirth;
    const ageYears = dob
      ? Math.max(0, Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
      : null;
    const income = n(loan.member.monthlyIncome) + n(loan.member.otherIncome);
    const installment = preview[0]?.totalDue ?? 0;
    if (income > 0 && installment > income * 0.4) {
      flags.push({ level: "warn", code: "dti", label: "Angsuran di atas 40% penghasilan tercatat" });
    } else if (income > 0) {
      flags.push({ level: "ok", code: "dti", label: "Angsuran masih dalam batas 40% penghasilan" });
    }

    return {
      loan: {
        id: loan.id,
        loanNo: loan.loanNo,
        principal,
        outstandingPrincipal: n(loan.outstandingPrincipal),
        status: loan.status,
        collectability: loan.collectability,
        annualRate: n(loan.annualRate),
        rateBasis: loan.rateBasis,
        method: loan.method,
        frequency: loan.frequency,
        periods: loan.periods,
        decisionKind: loan.decisionKind,
        decisionNote: loan.decisionNote,
        decisionConditions: loan.decisionConditions,
        decidedAt: loan.decidedAt,
        decidedBy: loan.decidedBy,
        conditionsClearedAt: loan.conditionsClearedAt,
        createdAt: loan.createdAt,
        product: loan.product,
        schedule: loan.schedule,
      },
      member: {
        id: loan.member.id,
        memberNo: loan.member.memberNo,
        name: loan.member.name,
        nik: loan.member.nik,
        gender: loan.member.gender,
        religion: loan.member.religion,
        maritalStatus: loan.member.maritalStatus,
        education: loan.member.education,
        phone: loan.member.phone,
        phoneAlt: loan.member.phoneAlt,
        email: loan.member.email,
        address: formatMemberAddress(loan.member) || loan.member.address,
        placeOfBirth: loan.member.placeOfBirth,
        dateOfBirth: loan.member.dateOfBirth,
        ageYears,
        motherName: loan.member.motherName,
        npwp: loan.member.npwp,
        familyCardNo: loan.member.familyCardNo,
        spouseName: loan.member.spouseName,
        dependents: loan.member.dependents,
        heirName: loan.member.heirName,
        heirRelation: loan.member.heirRelation,
        heirPhone: loan.member.heirPhone,
        emergencyName: loan.member.emergencyName,
        emergencyPhone: loan.member.emergencyPhone,
        emergencyRelation: loan.member.emergencyRelation,
        occupation: loan.member.occupation,
        employmentType: loan.member.employmentType,
        employerName: loan.member.employerName,
        workAddress: loan.member.workAddress,
        monthlyIncome: n(loan.member.monthlyIncome),
        otherIncome: n(loan.member.otherIncome),
        houseStatus: loan.member.houseStatus,
        yearsAtAddress: loan.member.yearsAtAddress,
        memberType: loan.member.memberType,
        status: loan.member.status,
        slikConsentAt: loan.member.slikConsentAt,
        branch: loan.member.branch,
        unit: loan.member.unit,
      },
      savings,
      savingsTotal,
      history,
      policy,
      flags,
      preview: {
        installment: preview[0]?.totalDue ?? 0,
        totalInterest: preview.reduce((sum, item) => sum + item.interestDue, 0),
        firstDue: preview[0]?.dueDate ?? null,
        lastDue: preview[preview.length - 1]?.dueDate ?? null,
        schedule: preview.slice(0, 6),
      },
    };
  }

  async listLoanProducts(tenantId: string) {
    const rows = await this.prisma.db.loanProduct.findMany({
      where: { tenantId },
      orderBy: { code: "asc" },
      include: {
        _count: { select: { loans: true } },
        loans: { where: { status: { not: "DRAFT" } }, select: { id: true }, take: 1 },
      },
    });
    return rows.map(({ loans, ...row }) => ({ ...row, hasLiveLoans: loans.length > 0 }));
  }

  async createLoanProduct(
    tenantId: string,
    input: {
      code: string;
      name: string;
      method: string;
      frequency: string;
      rateBasis?: string;
      annualRate: number;
      periods: number;
      graceDays?: number;
      penaltyKind?: string;
      penaltyValue?: number;
      minPrincipal?: number;
      maxPrincipal?: number | null;
    },
    actorId?: string,
  ) {
    const code = normalizeProductCode(input.code);
    reject(productCodeError(code));
    reject(productNameError(input.name));
    this.assertLoanTerms(input);
    reject(loanBoundError(input.minPrincipal ?? 0, input.maxPrincipal ?? null));
    const dup = await this.prisma.db.loanProduct.findUnique({ where: { tenantId_code: { tenantId, code } } });
    if (dup) throw new ConflictException({ code: ERROR_CODES.CONFLICT, message: "Kode produk sudah dipakai" });
    const product = await this.prisma.db.loanProduct.create({
      data: {
        tenantId,
        code,
        name: input.name.trim(),
        method: input.method,
        frequency: input.frequency,
        rateBasis: input.rateBasis ?? "ANNUAL",
        annualRate: input.annualRate,
        periods: input.periods,
        graceDays: input.graceDays ?? 0,
        penaltyKind: input.penaltyKind ?? "NONE",
        penaltyValue: input.penaltyValue ?? 0,
        minPrincipal: input.minPrincipal ?? 0,
        maxPrincipal: input.maxPrincipal ?? null,
      },
    });
    await this.audit.record({ action: "credit.product.created", resource: "loan_product", resourceId: product.id, tenantId, actorId });
    return product;
  }

  async updateLoanProduct(
    tenantId: string,
    id: string,
    input: {
      name?: string;
      method?: string;
      frequency?: string;
      rateBasis?: string;
      annualRate?: number;
      periods?: number;
      graceDays?: number;
      penaltyKind?: string;
      penaltyValue?: number;
      minPrincipal?: number;
      maxPrincipal?: number | null;
      status?: string;
    },
    actorId?: string,
  ) {
    const existing = await this.prisma.db.loanProduct.findFirst({
      where: { id, tenantId },
      include: { loans: { where: { status: { not: "DRAFT" } }, select: { id: true }, take: 1 } },
    });
    if (!existing) throw new NotFoundException({ message: "Produk pinjaman tidak ditemukan" });
    const termsTouched =
      (input.method != null && input.method !== existing.method) ||
      (input.frequency != null && input.frequency !== existing.frequency) ||
      (input.rateBasis != null && input.rateBasis !== existing.rateBasis) ||
      (input.annualRate != null && input.annualRate !== n(existing.annualRate)) ||
      (input.periods != null && input.periods !== existing.periods);
    reject(changeLoanTermsError(termsTouched && existing.loans.length > 0));
    this.assertLoanTerms({
      method: input.method ?? existing.method,
      frequency: input.frequency ?? existing.frequency,
      rateBasis: input.rateBasis ?? existing.rateBasis,
      annualRate: input.annualRate ?? n(existing.annualRate),
      periods: input.periods ?? existing.periods,
      graceDays: input.graceDays ?? existing.graceDays,
      penaltyKind: input.penaltyKind ?? existing.penaltyKind,
      penaltyValue: input.penaltyValue ?? n(existing.penaltyValue),
    });
    reject(loanBoundError(input.minPrincipal ?? n(existing.minPrincipal), input.maxPrincipal === undefined ? (existing.maxPrincipal == null ? null : n(existing.maxPrincipal)) : input.maxPrincipal));
    reject(loanStatusChangeError(input.status));
    if (input.name) reject(productNameError(input.name));
    const product = await this.prisma.db.loanProduct.update({
      where: { id },
      data: {
        name: input.name?.trim() || undefined,
        method: input.method,
        frequency: input.frequency,
        rateBasis: input.rateBasis,
        annualRate: input.annualRate,
        periods: input.periods,
        graceDays: input.graceDays,
        penaltyKind: input.penaltyKind,
        penaltyValue: input.penaltyValue,
        minPrincipal: input.minPrincipal,
        maxPrincipal: input.maxPrincipal,
        status: input.status,
      },
    });
    await this.audit.record({ action: "credit.product.updated", resource: "loan_product", resourceId: product.id, tenantId, actorId });
    return product;
  }

  private assertLoanTerms(input: {
    method: string;
    frequency: string;
    rateBasis?: string;
    annualRate: number;
    periods: number;
    graceDays?: number;
    penaltyKind?: string;
    penaltyValue?: number;
  }) {
    if (!INTEREST_METHODS.includes(input.method as (typeof INTEREST_METHODS)[number])) {
      throw new BadRequestException({ message: "Metode bunga tidak dikenali" });
    }
    if (!INSTALLMENT_FREQUENCIES.includes(input.frequency as (typeof INSTALLMENT_FREQUENCIES)[number])) {
      throw new BadRequestException({ message: "Frekuensi angsuran tidak dikenali" });
    }
    const rateBasis = input.rateBasis ?? "ANNUAL";
    if (!RATE_BASES.includes(rateBasis as (typeof RATE_BASES)[number])) {
      throw new BadRequestException({ message: "Jenis bunga tidak dikenali" });
    }
    if (rateBasis === "DAILY") {
      if (!(input.annualRate >= 0 && input.annualRate <= 0.1)) {
        throw new BadRequestException({ message: "Bunga harian harus 0–10%" });
      }
    } else if (!(input.annualRate >= 0 && input.annualRate <= 2)) {
      throw new BadRequestException({ message: "Bunga harus 0–200%" });
    }
    if (!(Number.isInteger(input.periods) && input.periods >= 1 && input.periods <= 360)) {
      throw new BadRequestException({ message: "Tenor harus 1–360 kali" });
    }
    const graceDays = input.graceDays ?? 0;
    if (!(Number.isInteger(graceDays) && graceDays >= 0 && graceDays <= 90)) {
      throw new BadRequestException({ message: "Toleransi keterlambatan harus 0–90 hari" });
    }
    const penaltyKind = input.penaltyKind ?? "NONE";
    if (!PENALTY_KINDS.includes(penaltyKind as (typeof PENALTY_KINDS)[number])) {
      throw new BadRequestException({ message: "Jenis denda tidak dikenali" });
    }
    const penaltyValue = input.penaltyValue ?? 0;
    if (penaltyKind === "NONE") return;
    if (penaltyKind === "FIXED_ONCE" || penaltyKind === "FIXED_PER_DAY") {
      if (!(penaltyValue >= 0 && penaltyValue <= 10_000_000)) {
        throw new BadRequestException({ message: "Denda nominal harus 0–10.000.000" });
      }
    } else if (penaltyKind === "PERCENT_INSTALLMENT_PER_DAY") {
      if (!(penaltyValue >= 0 && penaltyValue <= 0.1)) {
        throw new BadRequestException({ message: "Denda harian harus 0–10% dari angsuran" });
      }
    } else if (!(penaltyValue >= 0 && penaltyValue <= 1)) {
      throw new BadRequestException({ message: "Denda harus 0–100% dari angsuran" });
    }
  }

  private async accruePenaltyDue(
    item: {
      id: string;
      dueDate: Date;
      principalDue: Prisma.Decimal | number | string;
      interestDue: Prisma.Decimal | number | string;
      penaltyDue: Prisma.Decimal | number | string;
      penaltyPaid: Prisma.Decimal | number | string;
    },
    product: { graceDays: number; penaltyKind: string; penaltyValue: Prisma.Decimal | number | string },
    asOfIso: string,
  ) {
    const kind = PENALTY_KINDS.includes(product.penaltyKind as (typeof PENALTY_KINDS)[number])
      ? (product.penaltyKind as (typeof PENALTY_KINDS)[number])
      : "NONE";
    const computed = computePenalty({
      dueDate: item.dueDate.toISOString().slice(0, 10),
      asOf: asOfIso,
      graceDays: product.graceDays,
      kind,
      value: n(product.penaltyValue),
      installment: n(item.principalDue) + n(item.interestDue),
    });
    const next = nextPenaltyDue(n(item.penaltyDue), computed, n(item.penaltyPaid));
    if (next > n(item.penaltyDue) + 0.001) {
      await this.prisma.db.loanScheduleItem.update({ where: { id: item.id }, data: { penaltyDue: next } });
      return next;
    }
    return n(item.penaltyDue);
  }

  listHolidays(tenantId: string) {
    return this.prisma.db.tenantHoliday.findMany({ where: { tenantId }, orderBy: { date: "asc" } });
  }

  async addHoliday(tenantId: string, input: { date: string; name: string }) {
    return this.prisma.db.tenantHoliday.create({
      data: { tenantId, date: new Date(`${input.date}T00:00:00Z`), name: input.name, source: "TENANT", enabled: true },
    });
  }

  async createLoan(
    tenantId: string,
    input: { memberId: string; productId: string; principal: number },
    actorId?: string,
  ) {
    const product = await this.prisma.db.loanProduct.findFirst({ where: { id: input.productId, tenantId, status: "ACTIVE" } });
    const member = await this.prisma.db.member.findFirst({ where: { id: input.memberId, tenantId } });
    if (!product || !member) throw new NotFoundException({ message: "Produk atau anggota tidak ditemukan" });
    if (member.status !== "ACTIVE") {
      throw new ConflictException({ message: "Anggota sudah berhenti, tidak bisa mengajukan pinjaman" });
    }
    reject(loanLimitError(input.principal, n(product.minPrincipal), product.maxPrincipal == null ? null : n(product.maxPrincipal)));
    const tenant = await this.prisma.db.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    const policy = parseTenantPolicy(tenant?.settings);
    if (policy.requirePokokForLoan) {
      const pokok = await this.prisma.db.savingProduct.findFirst({ where: { tenantId, kind: "POKOK", status: "ACTIVE" } });
      if (pokok) {
        const account = await this.prisma.db.savingAccount.findUnique({
          where: { memberId_productId: { memberId: member.id, productId: pokok.id } },
        });
        reject(membershipPaidError("pokok", true, n(account?.balance) >= n(pokok.minAmount)));
      }
    }
    if (policy.requireWajibForLoan) {
      const wajib = await this.prisma.db.savingProduct.findFirst({ where: { tenantId, kind: "WAJIB", status: "ACTIVE" } });
      if (wajib) {
        const account = await this.prisma.db.savingAccount.findUnique({
          where: { memberId_productId: { memberId: member.id, productId: wajib.id } },
        });
        reject(membershipPaidError("wajib", true, n(account?.balance) >= n(wajib.minAmount)));
      }
    }
    const seq = (await this.prisma.db.loan.count({ where: { tenantId } })) + 1;
    const loan = await this.prisma.db.loan.create({
      data: {
        tenantId,
        memberId: member.id,
        productId: product.id,
        loanNo: `PJM-${String(seq).padStart(4, "0")}`,
        principal: input.principal,
        outstandingPrincipal: input.principal,
        annualRate: product.annualRate,
        rateBasis: product.rateBasis,
        method: product.method,
        frequency: product.frequency,
        periods: product.periods,
        status: "DRAFT",
      },
    });
    await this.audit.record({ action: "credit.loan.applied", resource: "loan", resourceId: loan.id, tenantId, actorId });
    return loan;
  }

  async decideLoan(
    tenantId: string,
    loanId: string,
    input: { decision: string; note?: string; conditions?: string },
    actorId?: string,
  ) {
    reject(loanDecisionError(input));
    const decision = input.decision as LoanDecisionKind;
    const loan = await this.prisma.db.loan.findFirst({ where: { id: loanId, tenantId } });
    if (!loan) throw new NotFoundException({ message: "Pinjaman tidak ditemukan" });
    if (loan.status !== "DRAFT") throw new ConflictException({ message: "Putusan hanya untuk pengajuan yang masih menunggu" });
    const note = (input.note ?? "").trim();
    const conditions = decision === "CONDITIONAL" ? (input.conditions ?? "").trim() : null;
    const updated = await this.prisma.db.loan.update({
      where: { id: loan.id },
      data: {
        status: loanStatusFromDecision(decision),
        decisionKind: decision,
        decisionNote: note,
        decisionConditions: conditions,
        decidedAt: new Date(),
        decidedById: actorId ?? null,
      },
      include: {
        member: true,
        product: true,
        schedule: { orderBy: { sequence: "asc" } },
        decidedBy: { select: { id: true, name: true, email: true } },
      },
    });
    await this.audit.record({
      action: loanDecisionAuditAction(decision),
      resource: "loan",
      resourceId: loan.id,
      tenantId,
      actorId,
      metadata: { decision, note, conditions },
    });
    return updated;
  }

  async disburse(tenantId: string, loanId: string, actorId?: string, input?: { conditionsCleared?: boolean }) {
    const loan = await this.prisma.db.loan.findFirst({ where: { id: loanId, tenantId }, include: { member: true } });
    if (!loan) throw new NotFoundException({ message: "Pinjaman tidak ditemukan" });
    if (loan.status !== "APPROVED") throw new ConflictException({ message: "Pencairan hanya untuk pinjaman yang sudah disetujui" });
    if (loan.decisionKind === "CONDITIONAL" && !loan.conditionsClearedAt && !input?.conditionsCleared) {
      throw new ConflictException({
        message: "Pinjaman disetujui dengan syarat. Konfirmasi syarat sudah dipenuhi sebelum mencairkan.",
      });
    }
    const holidays = await this.prisma.db.tenantHoliday.findMany({ where: { tenantId, enabled: true } });
    const start = new Date().toISOString().slice(0, 10);
    const schedule = generateSchedule({
      principal: n(loan.principal),
      annualRate: n(loan.annualRate),
      rateBasis: loan.rateBasis as "ANNUAL" | "DAILY" | "PRINCIPAL_TOTAL",
      periods: loan.periods,
      method: loan.method as "FLAT" | "DECLINING" | "ANNUITY" | "DAILY_EFFECTIVE",
      frequency: loan.frequency as "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY",
      startDate: start,
      holidays: holidays.map((h) => ({
        date: h.date.toISOString().slice(0, 10),
        name: h.name,
        source: h.source as "NATIONAL" | "TENANT",
        enabled: h.enabled,
      })),
    });
    const receivable = await this.ledger.accountByCode(tenantId, "1201");
    const cash = await this.ledger.accountByCode(tenantId, "1101");
    const journal = await this.ledger.postFromSource(
      tenantId,
      {
        postedOn: start,
        memo: `Pencairan ${loan.loanNo} ${loan.member.name}`,
        sourceType: "credit.disburse",
        sourceId: loan.id,
        lines: [
          { accountId: receivable.id, debit: n(loan.principal), credit: 0 },
          { accountId: cash.id, debit: 0, credit: n(loan.principal) },
        ],
      },
      actorId,
    );
    await this.prisma.db.loanScheduleItem.createMany({
      data: schedule.map((item) => ({
        tenantId,
        loanId: loan.id,
        sequence: item.sequence,
        dueDate: new Date(`${item.dueDate}T00:00:00Z`),
        principalDue: item.principalDue,
        interestDue: item.interestDue,
      })),
    });
    return this.prisma.db.loan.update({
      where: { id: loan.id },
      data: {
        status: "DISBURSED",
        disbursedOn: new Date(`${start}T00:00:00Z`),
        journalId: journal.id,
        conditionsClearedAt: loan.conditionsClearedAt ?? (loan.decisionKind === "CONDITIONAL" ? new Date() : loan.conditionsClearedAt),
        conditionsClearedById: loan.conditionsClearedById ?? (loan.decisionKind === "CONDITIONAL" ? actorId ?? null : loan.conditionsClearedById),
      },
      include: { schedule: { orderBy: { sequence: "asc" } }, member: true, product: true },
    });
  }

  async todayCards(tenantId: string, scope: "due" | "early" = "due") {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const items = await this.prisma.db.loanScheduleItem.findMany({
      where: {
        tenantId,
        status: { not: "PAID" },
        dueDate: scope === "early" ? { gt: today } : { lte: today },
        loan: { status: "DISBURSED" },
      },
      include: { loan: { include: { member: true, product: true } } },
      orderBy: { dueDate: "asc" },
    });
    let filtered = items;
    if (scope === "early") {
      const dueNow = await this.prisma.db.loanScheduleItem.findMany({
        where: { tenantId, status: { not: "PAID" }, dueDate: { lte: today }, loan: { status: "DISBURSED" } },
        select: { loanId: true },
      });
      const blocked = new Set(dueNow.map((row) => row.loanId));
      filtered = items.filter((item) => !blocked.has(item.loanId));
    }
    const asOf = today.toISOString().slice(0, 10);
    const cards = [];
    for (const item of filtered) {
      const penaltyDue = await this.accruePenaltyDue(item, item.loan.product, asOf);
      const remain =
        n(item.principalDue) - n(item.principalPaid) + (n(item.interestDue) - n(item.interestPaid)) + (penaltyDue - n(item.penaltyPaid));
      if (!(remain > 0)) continue;
      const daysOverdue = Math.max(0, Math.floor((today.getTime() - item.dueDate.getTime()) / 86400000));
      const graceDays = item.loan.product.graceDays;
      cards.push({
        ...item,
        remaining: remain,
        penalty: Math.max(0, penaltyDue - n(item.penaltyPaid)),
        daysOverdue,
        graceDays,
        inGrace: daysOverdue > 0 && daysOverdue <= graceDays,
        upcoming: item.dueDate.getTime() > today.getTime(),
        collectability: gradeCollectability(daysOverdue),
      });
    }
    return cards;
  }

  async collect(
    tenantId: string,
    input: { loanId: string; amount: number; clientReceiptId: string; paidOn?: string },
    actorId?: string,
  ) {
    const existing = await this.prisma.db.collectionReceipt.findUnique({
      where: { tenantId_clientReceiptId: { tenantId, clientReceiptId: input.clientReceiptId } },
    });
    if (existing) return existing;
    const loan = await this.prisma.db.loan.findFirst({
      where: { id: input.loanId, tenantId },
      include: { member: true, product: true, schedule: { orderBy: { sequence: "asc" } } },
    });
    if (!loan || loan.status !== "DISBURSED") throw new NotFoundException({ message: "Pinjaman aktif tidak ditemukan" });
    const amount = Number(input.amount);
    if (!(amount > 0)) throw new BadRequestException({ message: "Nominal setoran tidak valid" });
    const unpaid = loan.schedule.filter((s) => s.status !== "PAID");
    const asOf = input.paidOn ?? new Date().toISOString().slice(0, 10);
    const penaltyDueById = new Map<string, number>();
    for (const item of unpaid) {
      penaltyDueById.set(item.id, await this.accruePenaltyDue(item, loan.product, asOf));
    }
    const spread = spreadPayment(
      amount,
      unpaid.map((item) => ({
        id: item.id,
        penalty: (penaltyDueById.get(item.id) ?? n(item.penaltyDue)) - n(item.penaltyPaid),
        interest: n(item.interestDue) - n(item.interestPaid),
        principal: n(item.principalDue) - n(item.principalPaid),
      })),
    );
    const alloc = unpaid.length
      ? spread.totals
      : { penalty: 0, interest: 0, principal: Math.min(amount, n(loan.outstandingPrincipal)), leftover: Math.max(0, amount - n(loan.outstandingPrincipal)) };
    const cash = await this.ledger.accountByCode(tenantId, "1101");
    const receivable = await this.ledger.accountByCode(tenantId, "1201");
    const interestAcc = await this.ledger.accountByCode(tenantId, "4101");
    const penaltyAcc = await this.ledger.accountByCode(tenantId, "4102");
    const paidOn = input.paidOn ?? new Date().toISOString().slice(0, 10);
    const lines = [
      { accountId: cash.id, debit: amount, credit: 0 },
      ...(alloc.principal ? [{ accountId: receivable.id, debit: 0, credit: alloc.principal }] : []),
      ...(alloc.interest ? [{ accountId: interestAcc.id, debit: 0, credit: alloc.interest }] : []),
      ...(alloc.penalty ? [{ accountId: penaltyAcc.id, debit: 0, credit: alloc.penalty }] : []),
      ...(alloc.leftover ? [{ accountId: receivable.id, debit: 0, credit: alloc.leftover }] : []),
    ];
    const journal = await this.ledger.postFromSource(
      tenantId,
      {
        postedOn: paidOn,
        memo: `Setoran ${loan.loanNo} ${loan.member.name}`,
        sourceType: "collection.receipt",
        sourceId: input.clientReceiptId,
        lines,
      },
      actorId,
    );
    for (const part of spread.items) {
      const item = unpaid.find((s) => s.id === part.id);
      if (!item) continue;
      const principalPaid = n(item.principalPaid) + part.principal;
      const interestPaid = n(item.interestPaid) + part.interest;
      const penaltyPaid = n(item.penaltyPaid) + part.penalty;
      const paidOff =
        principalPaid >= n(item.principalDue) - 0.01 && interestPaid >= n(item.interestDue) - 0.01 && penaltyPaid >= n(item.penaltyDue) - 0.01;
      await this.prisma.db.loanScheduleItem.update({
        where: { id: item.id },
        data: { principalPaid, interestPaid, penaltyPaid, status: paidOff ? "PAID" : "PARTIAL" },
      });
    }
    const nextOutstanding = Math.max(0, n(loan.outstandingPrincipal) - alloc.principal - alloc.leftover);
    const paidIds = new Set(spread.items.filter((part) => {
      const item = unpaid.find((s) => s.id === part.id);
      if (!item) return false;
      return (
        n(item.principalPaid) + part.principal >= n(item.principalDue) - 0.01 &&
        n(item.interestPaid) + part.interest >= n(item.interestDue) - 0.01 &&
        n(item.penaltyPaid) + part.penalty >= n(item.penaltyDue) - 0.01
      );
    }).map((part) => part.id));
    const overdueItem = loan.schedule.find((s) => s.status !== "PAID" && !paidIds.has(s.id) && s.dueDate < new Date());
    const days = overdueItem ? Math.max(0, Math.floor((Date.now() - overdueItem.dueDate.getTime()) / 86400000)) : 0;
    await this.prisma.db.loan.update({
      where: { id: loan.id },
      data: {
        outstandingPrincipal: nextOutstanding,
        collectability: gradeCollectability(days),
        status: nextOutstanding <= 0 ? "CLOSED" : "DISBURSED",
      },
    });
    const firstItemId = spread.items[0]?.id;
    const count = (await this.prisma.db.collectionReceipt.count({ where: { tenantId } })) + 1;
    const receipt = await this.prisma.db.collectionReceipt.create({
      data: {
        tenantId,
        loanId: loan.id,
        memberId: loan.memberId,
        collectorId: actorId,
        receiptNo: `KWT-${paidOn.replaceAll("-", "")}-${String(count).padStart(4, "0")}`,
        clientReceiptId: input.clientReceiptId,
        amount,
        journalId: journal.id,
        scheduleItemId: firstItemId,
        paidOn: new Date(`${paidOn}T00:00:00Z`),
        allocation: { ...alloc, scheduleItemId: firstItemId, items: spread.items } as unknown as Prisma.InputJsonValue,
      },
      include: { member: true, loan: true },
    });
    await this.audit.record({ action: "collection.receipt.received", resource: "receipt", resourceId: receipt.id, tenantId, actorId });
    return { receipt: { id: receipt.id, receiptNo: receipt.receiptNo }, journal, allocation: alloc };
  }

  async listReceipts(tenantId: string) {
    return this.loadReceipts(tenantId);
  }

  async getReceipt(tenantId: string, id: string) {
    const rows = await this.loadReceipts(tenantId, id);
    const row = rows[0];
    if (!row) throw new NotFoundException({ message: "Kwitansi tidak ditemukan" });
    return row;
  }

  private async loadReceipts(tenantId: string, id?: string) {
    const tenant = await this.prisma.db.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, legalName: true },
    });
    const rows = await this.prisma.db.collectionReceipt.findMany({
      where: { tenantId, ...(id ? { id } : {}) },
      orderBy: { createdAt: "desc" },
      take: id ? 1 : 50,
      include: {
        member: { select: { name: true, memberNo: true, phone: true, address: true } },
        loan: {
          select: {
            loanNo: true,
            product: { select: { name: true } },
            schedule: { select: { id: true, sequence: true } },
          },
        },
        collector: { select: { name: true } },
      },
    });
    const journalIds = rows.map((row) => row.journalId).filter((value): value is string => Boolean(value));
    const journals = journalIds.length
      ? await this.prisma.db.journalEntry.findMany({
          where: { tenantId, id: { in: journalIds } },
          select: { id: true, number: true },
        })
      : [];
    const journalNo = new Map(journals.map((row) => [row.id, row.number]));
    return rows.map((row) => {
      const alloc = parseReceiptAlloc(row.allocation);
      const sequenceById = new Map(row.loan.schedule.map((item) => [item.id, item.sequence]));
      return {
        id: row.id,
        receiptNo: row.receiptNo,
        amount: n(row.amount),
        paidOn: row.paidOn,
        status: row.status,
        createdAt: row.createdAt,
        voidedAt: row.voidedAt,
        tenant: { name: tenant?.name ?? "Koperasi", legalName: tenant?.legalName ?? null },
        member: row.member,
        loan: { loanNo: row.loan.loanNo, productName: row.loan.product.name },
        collectorName: row.collector?.name ?? null,
        journalNo: row.journalId ? journalNo.get(row.journalId) ?? null : null,
        allocation: {
          principal: alloc.principal,
          interest: alloc.interest,
          penalty: alloc.penalty,
          leftover: alloc.leftover,
          items: alloc.items.map((item) => ({
            sequence: sequenceById.get(item.id) ?? null,
            principal: item.principal,
            interest: item.interest,
            penalty: item.penalty,
          })),
        },
      };
    });
  }

  async voidReceipt(tenantId: string, receiptId: string, actorId?: string) {
    const receipt = await this.prisma.db.collectionReceipt.findFirst({
      where: { id: receiptId, tenantId },
      include: { loan: { include: { schedule: { orderBy: { sequence: "asc" } } } }, member: true },
    });
    if (!receipt) throw new NotFoundException({ message: "Kwitansi tidak ditemukan" });
    if (receipt.status === "VOIDED") throw new ConflictException({ message: "Kwitansi sudah dibatalkan" });
    const later = await this.prisma.db.collectionReceipt.findFirst({
      where: { tenantId, loanId: receipt.loanId, status: "POSTED", createdAt: { gt: receipt.createdAt } },
    });
    if (later) throw new BadRequestException({ message: `Batalkan dulu kwitansi yang lebih baru (${later.receiptNo})` });
    const alloc = parseReceiptAlloc(receipt.allocation);
    const parts =
      alloc.items.length > 0
        ? alloc.items
        : receipt.scheduleItemId || alloc.scheduleItemId
          ? [
              {
                id: receipt.scheduleItemId ?? alloc.scheduleItemId ?? "",
                principal: alloc.principal + alloc.leftover,
                interest: alloc.interest,
                penalty: alloc.penalty,
              },
            ]
          : [];
    if (parts.length === 0) {
      const fallback = [...receipt.loan.schedule].reverse().find(
        (s) =>
          n(s.principalPaid) + 0.001 >= alloc.principal + alloc.leftover &&
          n(s.interestPaid) + 0.001 >= alloc.interest &&
          n(s.penaltyPaid) + 0.001 >= alloc.penalty,
      );
      if (fallback) {
        parts.push({
          id: fallback.id,
          principal: alloc.principal + alloc.leftover,
          interest: alloc.interest,
          penalty: alloc.penalty,
        });
      }
    }
    for (const part of parts) {
      const item = receipt.loan.schedule.find((s) => s.id === part.id);
      if (!item) continue;
      const principalPaid = Math.max(0, n(item.principalPaid) - part.principal);
      const interestPaid = Math.max(0, n(item.interestPaid) - part.interest);
      const penaltyPaid = Math.max(0, n(item.penaltyPaid) - part.penalty);
      const untouched = principalPaid <= 0.01 && interestPaid <= 0.01 && penaltyPaid <= 0.01;
      await this.prisma.db.loanScheduleItem.update({
        where: { id: item.id },
        data: { principalPaid, interestPaid, penaltyPaid, status: untouched ? "DUE" : "PARTIAL" },
      });
    }
    const nextOutstanding = n(receipt.loan.outstandingPrincipal) + alloc.principal + alloc.leftover;
    const schedule = await this.prisma.db.loanScheduleItem.findMany({ where: { loanId: receipt.loanId } });
    const overdueItem = schedule.find((s) => s.status !== "PAID" && s.dueDate < new Date());
    const days = overdueItem ? Math.max(0, Math.floor((Date.now() - overdueItem.dueDate.getTime()) / 86400000)) : 0;
    await this.prisma.db.loan.update({
      where: { id: receipt.loanId },
      data: {
        outstandingPrincipal: nextOutstanding,
        collectability: gradeCollectability(days),
        status: nextOutstanding > 0 && receipt.loan.status === "CLOSED" ? "DISBURSED" : receipt.loan.status,
      },
    });
    let voidJournalId: string | undefined;
    if (receipt.journalId) {
      const original = await this.prisma.db.journalEntry.findFirst({
        where: { id: receipt.journalId, tenantId },
        include: { reversedBy: { select: { id: true } } },
      });
      if (original && original.status !== "REVERSED" && original.reversedBy.length === 0) {
        const reversal = await this.ledger.reverse(tenantId, original.id, actorId, { fromOperation: true });
        voidJournalId = reversal.id;
      } else {
        voidJournalId = original?.reversedBy[0]?.id;
      }
    }
    const updated = await this.prisma.db.collectionReceipt.update({
      where: { id: receipt.id },
      data: { status: "VOIDED", voidedAt: new Date(), voidJournalId },
      include: { member: true, loan: true },
    });
    await this.audit.record({ action: "collection.receipt.voided", resource: "receipt", resourceId: receipt.id, tenantId, actorId });
    return updated;
  }

  async analytics(tenantId: string) {
    const [members, savings, loans, reports] = await Promise.all([
      this.prisma.db.member.count({ where: { tenantId, status: "ACTIVE" } }),
      this.prisma.db.savingAccount.aggregate({ where: { tenantId }, _sum: { balance: true } }),
      this.prisma.db.loan.findMany({ where: { tenantId } }),
      this.ledger.reports(tenantId),
    ]);
    const outstanding = loans.reduce((s, l) => s + n(l.outstandingPrincipal), 0);
    const npl = loans.filter((l) => l.collectability >= 3 && l.status === "DISBURSED");
    const nplAmount = npl.reduce((s, l) => s + n(l.outstandingPrincipal), 0);
    const phuNet = reports.phu.reduce((s, r) => s + (r.classCode === "4" ? r.net : -r.net), 0);
    const yearClose = await this.prisma.db.yearClose.findUnique({
      where: { tenantId_year: { tenantId, year: new Date().getUTCFullYear() } },
    });
    const aging = { lancar: 0, dpk: 0, kurang: 0, diragukan: 0, macet: 0 };
    for (const loan of loans) {
      const bucket =
        loan.collectability === 1 ? "lancar" : loan.collectability === 2 ? "dpk" : loan.collectability === 3 ? "kurang" : loan.collectability === 4 ? "diragukan" : "macet";
      aging[bucket] += n(loan.outstandingPrincipal);
    }
    return {
      members,
      savings: n(savings._sum.balance),
      outstanding,
      nplCount: npl.length,
      nplAmount,
      nplRatio: outstanding ? nplAmount / outstanding : 0,
      shu: yearClose ? n(yearClose.phuNet) : phuNet,
      aging,
      cash: reports.cashPosition.total,
      cashKas: reports.cashPosition.kas,
      cashBank: reports.cashPosition.bank,
      ojk: reports.ojk,
      trial: reports.trial,
    };
  }

  async overview(tenantId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [members, savings, loans, units, dueItems, receiptsToday, reports] = await Promise.all([
      this.prisma.db.member.count({ where: { tenantId, status: "ACTIVE" } }),
      this.prisma.db.savingAccount.aggregate({ where: { tenantId }, _sum: { balance: true } }),
      this.prisma.db.loan.findMany({
        where: { tenantId },
        select: { status: true, collectability: true, outstandingPrincipal: true },
      }),
      this.prisma.db.unit.count({ where: { tenantId, status: "ACTIVE" } }),
      this.prisma.db.loanScheduleItem.findMany({
        where: { tenantId, status: { not: "PAID" }, dueDate: { lte: today }, loan: { status: "DISBURSED" } },
        select: {
          dueDate: true,
          principalDue: true,
          interestDue: true,
          penaltyDue: true,
          principalPaid: true,
          interestPaid: true,
          penaltyPaid: true,
        },
      }),
      this.prisma.db.collectionReceipt.aggregate({
        where: { tenantId, status: "POSTED", paidOn: { gte: today } },
        _count: true,
        _sum: { amount: true },
      }),
      this.ledger.reports(tenantId),
    ]);
    const live = loans.filter((l) => l.status === "DISBURSED");
    const outstanding = live.reduce((s, l) => s + n(l.outstandingPrincipal), 0);
    const npl = live.filter((l) => l.collectability >= 3);
    const nplAmount = npl.reduce((s, l) => s + n(l.outstandingPrincipal), 0);
    let collectionDue = 0;
    let collectionOverdue = 0;
    let collectionDueAmount = 0;
    for (const item of dueItems) {
      const remain =
        n(item.principalDue) +
        n(item.interestDue) +
        n(item.penaltyDue) -
        n(item.principalPaid) -
        n(item.interestPaid) -
        n(item.penaltyPaid);
      collectionDueAmount += Math.max(remain, 0);
      if (item.dueDate.getTime() < today.getTime()) collectionOverdue += 1;
      else collectionDue += 1;
    }
    return {
      members,
      savings: n(savings._sum.balance),
      outstanding,
      nplCount: npl.length,
      nplAmount,
      nplRatio: outstanding ? nplAmount / outstanding : 0,
      pendingApproval: loans.filter((l) => l.status === "DRAFT").length,
      pendingDisburse: loans.filter((l) => l.status === "APPROVED").length,
      collectionDue,
      collectionOverdue,
      collectionDueAmount,
      collectedToday: n(receiptsToday._sum.amount),
      collectedTodayCount: receiptsToday._count,
      cash: reports.cashPosition.total,
      cashKas: reports.cashPosition.kas,
      cashBank: reports.cashPosition.bank,
      units,
    };
  }
}
