import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  DEFAULT_CKPN_RATES,
  DEFAULT_COA_TEMPLATE,
  DEFAULT_EXPENSE_BUDGETS,
  DEFAULT_SHU_SHARES,
  OJK_MAPS,
  allocateShu,
  assessBudget,
  assertJournal,
  netBalance,
  requiredCkpn,
  splitStatements,
  summarizeCashFlow,
  trialBalance,
} from "@mankopi/ledger-engine";
import { ERROR_CODES } from "@mankopi/shared";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

function money(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value ?? 0);
}

const SKIP_BUDGET = new Set(["reverse", "opening.capital", "year.close", "shu.allocate"]);
const YEAR_CLOSE_OK = new Set(["reverse", "year.close", "shu.allocate"]);

function periodBounds(year: number, month: number) {
  const startsOn = new Date(Date.UTC(year, month - 1, 1));
  const endsOn = new Date(Date.UTC(year, month, 0));
  return { startsOn, endsOn };
}

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async provision(tenantId: string) {
    const existing = await this.prisma.db.account.findMany({ where: { tenantId }, select: { code: true } });
    const have = new Set(existing.map((a) => a.code));
    const missing = DEFAULT_COA_TEMPLATE.filter((a) => !have.has(a.code));
    if (missing.length) {
      await this.prisma.db.account.createMany({
        data: missing.map((a) => ({
          tenantId,
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
      await this.prisma.db.account.updateMany({
        where: { tenantId, code: a.code },
        data: { cashFlow: a.cashFlow, ojkMap: a.ojkMap },
      });
    }
    const now = new Date();
    await this.ensurePeriod(tenantId, now.getUTCFullYear(), now.getUTCMonth() + 1);
    await this.seedPolicies(tenantId);
  }

  async seedPolicies(tenantId: string) {
    if ((await this.prisma.db.expenseBudgetPolicy.count({ where: { tenantId } })) === 0) {
      await this.prisma.db.expenseBudgetPolicy.createMany({
        data: DEFAULT_EXPENSE_BUDGETS.map((row) => ({
          tenantId,
          accountCode: row.accountCode,
          name: row.name,
          percent: row.percent,
        })),
      });
    }
    if ((await this.prisma.db.ckpnRate.count({ where: { tenantId } })) === 0) {
      await this.prisma.db.ckpnRate.createMany({
        data: DEFAULT_CKPN_RATES.map((row) => ({ tenantId, grade: row.grade, percent: row.percent })),
      });
    }
    if ((await this.prisma.db.shuSharePolicy.count({ where: { tenantId } })) === 0) {
      await this.prisma.db.shuSharePolicy.createMany({
        data: DEFAULT_SHU_SHARES.map((row) => ({
          tenantId,
          accountCode: row.accountCode,
          name: row.name,
          percent: row.percent,
          sortOrder: row.sortOrder,
        })),
      });
    }
  }

  async ensurePeriod(tenantId: string, year: number, month: number) {
    const existing = await this.prisma.db.accountingPeriod.findUnique({
      where: { tenantId_year_month: { tenantId, year, month } },
    });
    if (existing) return existing;
    const { startsOn, endsOn } = periodBounds(year, month);
    return this.prisma.db.accountingPeriod.create({
      data: { tenantId, year, month, startsOn, endsOn, status: "OPEN" },
    });
  }

  listAccounts(tenantId: string) {
    return this.prisma.db.account.findMany({
      where: { tenantId },
      orderBy: { code: "asc" },
    });
  }

  ojkMaps() {
    return OJK_MAPS;
  }

  async createAccount(
    tenantId: string,
    input: {
      code: string;
      name: string;
      classCode: string;
      normalBalance: "DEBIT" | "CREDIT";
      isCash?: boolean;
      report: "NERACA" | "PHU" | "ARUS_KAS";
      cashFlow?: string;
      ojkMap?: string;
    },
    actorId?: string,
  ) {
    const code = input.code.trim();
    if (!/^[1-5]\d{3,5}$/.test(code)) {
      throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message: "Kode akun harus 4–6 digit, diawali 1–5" });
    }
    const exists = await this.prisma.db.account.findUnique({ where: { tenantId_code: { tenantId, code } } });
    if (exists) {
      throw new ConflictException({ code: ERROR_CODES.CONFLICT, message: "Kode akun sudah ada" });
    }
    const account = await this.prisma.db.account.create({
      data: {
        tenantId,
        code,
        name: input.name,
        classCode: code[0],
        normalBalance: input.normalBalance,
        isCash: Boolean(input.isCash),
        report: input.report,
        cashFlow: input.cashFlow,
        ojkMap: input.ojkMap,
      },
    });
    await this.audit.record({
      action: "ledger.account.created",
      resource: "account",
      resourceId: account.id,
      tenantId,
      actorId,
    });
    return account;
  }

  async updateAccount(
    tenantId: string,
    id: string,
    input: { name?: string; ojkMap?: string | null; status?: string; isCash?: boolean; cashFlow?: string | null },
    actorId?: string,
  ) {
    const account = await this.prisma.db.account.findFirst({ where: { id, tenantId } });
    if (!account) throw new NotFoundException({ code: ERROR_CODES.VALIDATION_FAILED, message: "Akun tidak ditemukan" });
    const updated = await this.prisma.db.account.update({
      where: { id },
      data: {
        name: input.name ?? account.name,
        ojkMap: input.ojkMap === undefined ? account.ojkMap : input.ojkMap,
        status: input.status ?? account.status,
        isCash: input.isCash ?? account.isCash,
        cashFlow: input.cashFlow === undefined ? account.cashFlow : input.cashFlow,
      },
    });
    await this.audit.record({ action: "ledger.account.updated", resource: "account", resourceId: id, tenantId, actorId });
    return updated;
  }

  listPeriods(tenantId: string) {
    return this.prisma.db.accountingPeriod.findMany({
      where: { tenantId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      include: { _count: { select: { journals: true } } },
    });
  }

  async openPeriod(tenantId: string, year: number, month: number, actorId?: string) {
    const period = await this.ensurePeriod(tenantId, year, month);
    if (period.status === "CLOSED") {
      throw new ConflictException({ code: ERROR_CODES.PERIOD_CLOSED, message: "Periode ini sudah ditutup" });
    }
    await this.audit.record({ action: "ledger.period.opened", resource: "period", resourceId: period.id, tenantId, actorId });
    return period;
  }

  async closePeriod(tenantId: string, id: string, actorId?: string) {
    const period = await this.prisma.db.accountingPeriod.findFirst({ where: { id, tenantId } });
    if (!period) throw new NotFoundException({ message: "Periode tidak ditemukan" });
    if (period.status === "CLOSED") return period;
    const updated = await this.prisma.db.accountingPeriod.update({
      where: { id },
      data: { status: "CLOSED", closedAt: new Date(), closedBy: actorId },
    });
    await this.audit.record({ action: "ledger.period.closed", resource: "period", resourceId: id, tenantId, actorId });
    return updated;
  }

  listJournals(tenantId: string) {
    return this.prisma.db.journalEntry.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        lines: { include: { account: true }, orderBy: { lineNo: "asc" } },
        period: true,
      },
    });
  }

  async accountByCode(tenantId: string, code: string) {
    const account = await this.prisma.db.account.findUnique({ where: { tenantId_code: { tenantId, code } } });
    if (!account) {
      throw new NotFoundException({ message: `Akun ${code} belum ada di bagan perkiraan` });
    }
    return account;
  }

  async postFromSource(
    tenantId: string,
    input: {
      postedOn: string;
      memo?: string;
      sourceType: string;
      sourceId?: string;
      lines: Array<{ accountId: string; debit: number; credit: number; memo?: string }>;
    },
    actorId?: string,
  ) {
    return this.post(tenantId, input, actorId);
  }

  async postManual(
    tenantId: string,
    input: {
      postedOn: string;
      memo?: string;
      lines: Array<{ accountId: string; debit: number; credit: number; memo?: string }>;
    },
    actorId?: string,
  ) {
    return this.post(tenantId, { ...input, sourceType: "manual", sourceId: undefined }, actorId);
  }

  async reverse(tenantId: string, journalId: string, actorId?: string, opts?: { fromOperation?: boolean }) {
    const original = await this.prisma.db.journalEntry.findFirst({
      where: { id: journalId, tenantId },
      include: { lines: true, reversedBy: true },
    });
    if (!original) throw new NotFoundException({ message: "Jurnal tidak ditemukan" });
    if (original.status === "REVERSED" || original.reversedBy.length > 0) {
      throw new ConflictException({ code: ERROR_CODES.CONFLICT, message: "Jurnal sudah dibalik" });
    }
    if (original.sourceType !== "manual" && original.sourceType !== "opening.capital" && !opts?.fromOperation) {
      throw new BadRequestException({
        message: "Jurnal dari setor, tarik, pencairan, tagihan, atau payroll tidak dibalik dari sini. Koreksi lewat halaman operasional.",
      });
    }
    const today = new Date().toISOString().slice(0, 10);
    const reversal = await this.post(
      tenantId,
      {
        postedOn: today,
        memo: `Balikan ${original.number}`,
        sourceType: "reverse",
        sourceId: original.id,
        reversesId: original.id,
        lines: original.lines.map((l) => ({
          accountId: l.accountId,
          debit: money(l.credit),
          credit: money(l.debit),
          memo: l.memo ?? undefined,
        })),
      },
      actorId,
    );
    await this.prisma.db.journalEntry.update({ where: { id: original.id }, data: { status: "REVERSED" } });
    return reversal;
  }

  private async post(
    tenantId: string,
    input: {
      postedOn: string;
      memo?: string;
      sourceType: string;
      sourceId?: string;
      reversesId?: string;
      lines: Array<{ accountId: string; debit: number; credit: number; memo?: string }>;
    },
    actorId?: string,
  ) {
    const postedOn = new Date(`${input.postedOn}T00:00:00.000Z`);
    if (Number.isNaN(postedOn.getTime())) {
      throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message: "Tanggal jurnal tidak valid" });
    }
    const year = postedOn.getUTCFullYear();
    const month = postedOn.getUTCMonth() + 1;
    const period = await this.prisma.db.accountingPeriod.findUnique({
      where: { tenantId_year_month: { tenantId, year, month } },
    });
    if (!period || period.status !== "OPEN") {
      throw new BadRequestException({
        code: ERROR_CODES.PERIOD_CLOSED,
        message: "Periode untuk tanggal ini belum dibuka atau sudah ditutup",
      });
    }
    const accounts = await this.prisma.db.account.findMany({
      where: { tenantId, id: { in: input.lines.map((l) => l.accountId) } },
    });
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const engineLines = input.lines.map((line) => {
      const account = byId.get(line.accountId);
      if (!account || account.status !== "ACTIVE") {
        throw new BadRequestException({ code: ERROR_CODES.VALIDATION_FAILED, message: "Akun tidak aktif atau tidak ditemukan" });
      }
      return {
        accountCode: account.code,
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        memo: line.memo,
      };
    });
    await this.assertYearOpen(tenantId, year, input.sourceType, accounts);
    await this.assertExpenseBudget(tenantId, year, input.sourceType, input.lines, byId);
    try {
      assertJournal({
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? "manual",
        periodOpen: true,
        lines: engineLines,
      });
    } catch (err) {
      const code = (err as { code?: string }).code ?? ERROR_CODES.JOURNAL_UNBALANCED;
      throw new BadRequestException({
        code,
        message: err instanceof Error ? err.message : "Jurnal tidak seimbang",
      });
    }
    const debitTotal = engineLines.reduce((s, l) => s + l.debit, 0);
    const creditTotal = engineLines.reduce((s, l) => s + l.credit, 0);
    const seq = (await this.prisma.db.journalEntry.count({ where: { tenantId, periodId: period.id } })) + 1;
    const number = `JRN-${year}${String(month).padStart(2, "0")}-${String(seq).padStart(4, "0")}`;
    const journal = await this.prisma.db.journalEntry.create({
      data: {
        tenantId,
        periodId: period.id,
        number,
        postedOn,
        memo: input.memo,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        reversesId: input.reversesId,
        debitTotal,
        creditTotal,
        createdBy: actorId,
        lines: {
          create: input.lines.map((line, index) => ({
            tenantId,
            accountId: line.accountId,
            lineNo: index + 1,
            debit: line.debit,
            credit: line.credit,
            memo: line.memo,
          })),
        },
      },
      include: { lines: { include: { account: true }, orderBy: { lineNo: "asc" } }, period: true },
    });
    await this.audit.record({
      action: "ledger.journal.posted",
      resource: "journal",
      resourceId: journal.id,
      tenantId,
      actorId,
      metadata: { number, sourceType: input.sourceType },
    });
    return journal;
  }

  async reports(tenantId: string, year?: number, month?: number) {
    const periodFilter =
      year && month
        ? { period: { tenantId, year, month } }
        : {};
    const lines = await this.prisma.db.journalLine.findMany({
      where: { tenantId, journal: { tenantId, ...periodFilter } },
      include: { account: true, journal: { select: { id: true } } },
    });
    const byAccount = new Map<string, { account: (typeof lines)[number]["account"]; debit: number; credit: number }>();
    for (const line of lines) {
      const row = byAccount.get(line.accountId) ?? { account: line.account, debit: 0, credit: 0 };
      row.debit += money(line.debit);
      row.credit += money(line.credit);
      byAccount.set(line.accountId, row);
    }
    const balances = [...byAccount.values()].map((r) => ({
      accountCode: r.account.code,
      name: r.account.name,
      classCode: r.account.classCode,
      ojkMap: r.account.ojkMap,
      isCash: r.account.isCash,
      debit: r.debit,
      credit: r.credit,
      net: netBalance(r.account.code, r.debit, r.credit),
    }));
    const trial = trialBalance(balances);
    const { neraca, phu } = splitStatements(balances);
    const journals = await this.prisma.db.journalEntry.findMany({
      where: { tenantId, ...(year && month ? { period: { year, month } } : {}) },
      include: { lines: { include: { account: true } } },
    });
    const cash = { OPERATING: 0, INVESTING: 0, FINANCING: 0 };
    const cashMoves: Array<{
      journalId: string;
      number: string;
      postedOn: Date;
      sourceType: string;
      memo: string | null;
      kind: "OPERATING" | "INVESTING" | "FINANCING";
      amount: number;
    }> = [];
    for (const journal of journals) {
      const part = summarizeCashFlow(
        journal.lines.map((l) => ({
          accountCode: l.account.code,
          classCode: l.account.classCode,
          isCash: l.account.isCash,
          cashFlow: l.account.cashFlow,
          ojkMap: l.account.ojkMap,
          debit: money(l.debit),
          credit: money(l.credit),
        })),
      );
      cash.OPERATING += part.OPERATING;
      cash.INVESTING += part.INVESTING;
      cash.FINANCING += part.FINANCING;
      for (const kind of ["OPERATING", "INVESTING", "FINANCING"] as const) {
        if (part[kind] === 0) continue;
        cashMoves.push({
          journalId: journal.id,
          number: journal.number,
          postedOn: journal.postedOn,
          sourceType: journal.sourceType,
          memo: journal.memo,
          kind,
          amount: part[kind],
        });
      }
    }
    cashMoves.sort((a, b) => a.number.localeCompare(b.number));
    const ojk = new Map<string, { key: string; label: string; net: number }>();
    for (const row of balances) {
      const key = row.ojkMap ?? "UNMAPPED";
      const label = OJK_MAPS.find((m) => m.key === key)?.label ?? "Belum dipetakan";
      const cur = ojk.get(key) ?? { key, label, net: 0 };
      cur.net += row.net;
      ojk.set(key, cur);
    }
    const cashLines = await this.prisma.db.journalLine.findMany({
      where: { tenantId, account: { isCash: true } },
      include: { account: { select: { code: true, name: true } } },
    });
    let kas = 0;
    let bank = 0;
    let other = 0;
    for (const line of cashLines) {
      const net = money(line.debit) - money(line.credit);
      if (line.account.code === "1101") kas += net;
      else if (line.account.code === "1102") bank += net;
      else other += net;
    }
    return {
      trial,
      neraca: neraca.map((r) => balances.find((b) => b.accountCode === r.accountCode)!),
      phu: phu.map((r) => balances.find((b) => b.accountCode === r.accountCode)!),
      cashFlow: cash,
      cashMoves,
      cashPosition: { kas, bank, other, total: kas + bank + other },
      ojk: [...ojk.values()].sort((a, b) => a.key.localeCompare(b.key)),
    };
  }

  private liveJournalWhere(tenantId: string, year: number): Prisma.JournalEntryWhereInput {
    return {
      tenantId,
      status: "POSTED",
      sourceType: { notIn: ["reverse", "year.close", "shu.allocate"] },
      period: { tenantId, year },
    };
  }

  private async yearAccountNet(tenantId: string, year: number, classCode: "4" | "5", accountCode?: string) {
    const lines = await this.prisma.db.journalLine.findMany({
      where: {
        tenantId,
        account: { classCode, ...(accountCode ? { code: accountCode } : {}) },
        journal: this.liveJournalWhere(tenantId, year),
      },
      include: { account: { select: { code: true, classCode: true } } },
    });
    let debit = 0;
    let credit = 0;
    for (const line of lines) {
      debit += money(line.debit);
      credit += money(line.credit);
    }
    return classCode === "4" ? credit - debit : debit - credit;
  }

  private async assertYearOpen(
    tenantId: string,
    year: number,
    sourceType: string,
    accounts: Array<{ classCode: string }>,
  ) {
    if (YEAR_CLOSE_OK.has(sourceType)) return;
    const closed = await this.prisma.db.yearClose.findUnique({ where: { tenantId_year: { tenantId, year } } });
    if (!closed) return;
    if (accounts.some((a) => a.classCode === "4" || a.classCode === "5")) {
      throw new ConflictException({
        message: `Tahun ${year} sudah ditutup. PHU tidak bisa diubah. Batalkan tutup buku dulu jika perlu koreksi.`,
      });
    }
  }

  private async assertExpenseBudget(
    tenantId: string,
    year: number,
    sourceType: string,
    lines: Array<{ accountId: string; debit: number; credit: number }>,
    byId: Map<string, { code: string; classCode: string; name: string }>,
  ) {
    if (SKIP_BUDGET.has(sourceType)) return;
    const policies = await this.prisma.db.expenseBudgetPolicy.findMany({ where: { tenantId, enabled: true } });
    if (!policies.length) return;
    const income = await this.yearAccountNet(tenantId, year, "4");
    const adding = new Map<string, number>();
    for (const line of lines) {
      const account = byId.get(line.accountId);
      if (!account || account.classCode !== "5") continue;
      adding.set(account.code, (adding.get(account.code) ?? 0) + (Number(line.debit) || 0) - (Number(line.credit) || 0));
    }
    for (const policy of policies) {
      const extra = adding.get(policy.accountCode) ?? 0;
      if (extra <= 0) continue;
      const spent = await this.yearAccountNet(tenantId, year, "5", policy.accountCode);
      const check = assessBudget({ income, percent: money(policy.percent), spent, adding: extra });
      if (check.ok) continue;
      throw new BadRequestException({
        message: `${policy.name} (${policy.accountCode}) melebihi porsi ${money(policy.percent)}% pendapatan tahun ${year}. Plafon ${check.cap.toLocaleString("id-ID")}, sudah terpakai ${spent.toLocaleString("id-ID")}, pengajuan +${extra.toLocaleString("id-ID")}. Pendapatan tahun ini ${income.toLocaleString("id-ID")}.`,
      });
    }
  }

  async budgetOverview(tenantId: string, year: number) {
    await this.seedPolicies(tenantId);
    const policies = await this.prisma.db.expenseBudgetPolicy.findMany({ where: { tenantId }, orderBy: { accountCode: "asc" } });
    const income = await this.yearAccountNet(tenantId, year, "4");
    const rows = [];
    for (const policy of policies) {
      const spent = await this.yearAccountNet(tenantId, year, "5", policy.accountCode);
      const check = assessBudget({ income, percent: money(policy.percent), spent, adding: 0 });
      rows.push({
        id: policy.id,
        accountCode: policy.accountCode,
        name: policy.name,
        percent: money(policy.percent),
        enabled: policy.enabled,
        spent,
        cap: check.cap,
        remaining: check.remaining,
      });
    }
    return { year, income, rows };
  }

  async saveBudgets(
    tenantId: string,
    rows: Array<{ accountCode: string; name?: string; percent: number; enabled?: boolean }>,
    actorId?: string,
  ) {
    await this.seedPolicies(tenantId);
    for (const row of rows) {
      if (!(row.percent >= 0 && row.percent <= 100)) {
        throw new BadRequestException({ message: `Porsi ${row.accountCode} harus 0–100%` });
      }
      await this.prisma.db.expenseBudgetPolicy.upsert({
        where: { tenantId_accountCode: { tenantId, accountCode: row.accountCode } },
        update: { percent: row.percent, enabled: row.enabled ?? true, name: row.name },
        create: {
          tenantId,
          accountCode: row.accountCode,
          name: row.name ?? row.accountCode,
          percent: row.percent,
          enabled: row.enabled ?? true,
        },
      });
    }
    await this.audit.record({ action: "ledger.budget.updated", resource: "budget", tenantId, actorId });
    return this.budgetOverview(tenantId, new Date().getUTCFullYear());
  }

  async ckpnOverview(tenantId: string) {
    await this.seedPolicies(tenantId);
    const rates = await this.prisma.db.ckpnRate.findMany({ where: { tenantId }, orderBy: { grade: "asc" } });
    const loans = await this.prisma.db.loan.findMany({
      where: { tenantId, status: "DISBURSED" },
      select: { outstandingPrincipal: true, collectability: true },
    });
    const computed = requiredCkpn(
      loans.map((l) => ({ outstanding: money(l.outstandingPrincipal), collectability: l.collectability })),
      rates.map((r) => ({ grade: r.grade, percent: money(r.percent) })),
    );
    const reserve = await this.prisma.db.account.findUnique({ where: { tenantId_code: { tenantId, code: "1202" } } });
    let current = 0;
    if (reserve) {
      const lines = await this.prisma.db.journalLine.findMany({
        where: { tenantId, accountId: reserve.id, journal: { tenantId, status: "POSTED", sourceType: { not: "reverse" } } },
      });
      current = lines.reduce((sum, l) => sum + money(l.credit) - money(l.debit), 0);
    }
    return {
      rates: rates.map((r) => ({ id: r.id, grade: r.grade, percent: money(r.percent) })),
      byGrade: computed.byGrade,
      required: computed.required,
      current,
      delta: Math.round((computed.required - current) * 100) / 100,
    };
  }

  async saveCkpnRates(tenantId: string, rows: Array<{ grade: number; percent: number }>, actorId?: string) {
    await this.seedPolicies(tenantId);
    for (const row of rows) {
      if (row.grade < 1 || row.grade > 5 || row.percent < 0 || row.percent > 100) {
        throw new BadRequestException({ message: "Tarif CKPN Kol 1–5 harus 0–100%" });
      }
      await this.prisma.db.ckpnRate.upsert({
        where: { tenantId_grade: { tenantId, grade: row.grade } },
        update: { percent: row.percent },
        create: { tenantId, grade: row.grade, percent: row.percent },
      });
    }
    await this.audit.record({ action: "ledger.ckpn.rates", resource: "ckpn", tenantId, actorId });
    return this.ckpnOverview(tenantId);
  }

  async postCkpn(tenantId: string, postedOn: string, actorId?: string) {
    const preview = await this.ckpnOverview(tenantId);
    if (Math.abs(preview.delta) < 0.01) {
      throw new BadRequestException({ message: "Cadangan risiko sudah sesuai perhitungan. Tidak ada jurnal yang perlu diposting." });
    }
    const expense = await this.accountByCode(tenantId, "5103");
    const reserve = await this.accountByCode(tenantId, "1202");
    const amount = Math.abs(preview.delta);
    const increase = preview.delta > 0;
    const journal = await this.post(
      tenantId,
      {
        postedOn,
        memo: increase ? "Pembentukan cadangan risiko pinjaman" : "Koreksi cadangan risiko pinjaman",
        sourceType: "credit.ckpn",
        sourceId: `ckpn-${postedOn}`,
        lines: increase
          ? [
              { accountId: expense.id, debit: amount, credit: 0 },
              { accountId: reserve.id, debit: 0, credit: amount },
            ]
          : [
              { accountId: reserve.id, debit: amount, credit: 0 },
              { accountId: expense.id, debit: 0, credit: amount },
            ],
      },
      actorId,
    );
    return { journal, ...preview, posted: preview.delta };
  }

  async shuPolicies(tenantId: string) {
    await this.seedPolicies(tenantId);
    const shares = await this.prisma.db.shuSharePolicy.findMany({ where: { tenantId }, orderBy: { sortOrder: "asc" } });
    return shares.map((s) => ({
      id: s.id,
      accountCode: s.accountCode,
      name: s.name,
      percent: money(s.percent),
      sortOrder: s.sortOrder,
    }));
  }

  async saveShuShares(
    tenantId: string,
    rows: Array<{ accountCode: string; name?: string; percent: number; sortOrder?: number }>,
    actorId?: string,
  ) {
    const total = rows.reduce((sum, r) => sum + r.percent, 0);
    if (Math.abs(total - 100) > 0.05) {
      throw new BadRequestException({ message: `Porsi alokasi SHU harus 100%. Sekarang ${total}%` });
    }
    await this.seedPolicies(tenantId);
    const keep = new Set(rows.map((r) => r.accountCode));
    await this.prisma.db.shuSharePolicy.deleteMany({ where: { tenantId, accountCode: { notIn: [...keep] } } });
    for (const [i, row] of rows.entries()) {
      await this.prisma.db.shuSharePolicy.upsert({
        where: { tenantId_accountCode: { tenantId, accountCode: row.accountCode } },
        update: { name: row.name ?? row.accountCode, percent: row.percent, sortOrder: row.sortOrder ?? i + 1 },
        create: {
          tenantId,
          accountCode: row.accountCode,
          name: row.name ?? row.accountCode,
          percent: row.percent,
          sortOrder: row.sortOrder ?? i + 1,
        },
      });
    }
    await this.audit.record({ action: "ledger.shu.shares", resource: "shu", tenantId, actorId });
    return this.shuPolicies(tenantId);
  }

  async yearClosePreview(tenantId: string, year: number) {
    await this.seedPolicies(tenantId);
    const existing = await this.prisma.db.yearClose.findUnique({ where: { tenantId_year: { tenantId, year } } });
    const income = await this.yearAccountNet(tenantId, year, "4");
    const expense = await this.yearAccountNet(tenantId, year, "5");
    const livePhu = Math.round((income - expense) * 100) / 100;
    const phuNet = existing ? money(existing.phuNet) : livePhu;
    const shares = await this.shuPolicies(tenantId);
    const allocation = phuNet > 0 ? allocateShu(phuNet, shares) : [];
    return {
      year,
      income,
      expense,
      livePhu,
      phuNet,
      closed: Boolean(existing),
      allocated: Boolean(existing?.allocateJournalId),
      closeJournalId: existing?.closeJournalId ?? null,
      allocateJournalId: existing?.allocateJournalId ?? null,
      shares,
      allocation,
    };
  }

  async closeYear(tenantId: string, year: number, actorId?: string) {
    const preview = await this.yearClosePreview(tenantId, year);
    if (preview.closed) throw new ConflictException({ message: `Tahun ${year} sudah ditutup` });
    const postedOn = `${year}-12-31`;
    await this.ensurePeriod(tenantId, year, 12);
    const lines = await this.prisma.db.journalLine.findMany({
      where: {
        tenantId,
        account: { classCode: { in: ["4", "5"] } },
        journal: this.liveJournalWhere(tenantId, year),
      },
      include: { account: true },
    });
    const byAccount = new Map<string, { id: string; code: string; classCode: string; debit: number; credit: number }>();
    for (const line of lines) {
      const row = byAccount.get(line.accountId) ?? {
        id: line.accountId,
        code: line.account.code,
        classCode: line.account.classCode,
        debit: 0,
        credit: 0,
      };
      row.debit += money(line.debit);
      row.credit += money(line.credit);
      byAccount.set(line.accountId, row);
    }
    const shu = await this.accountByCode(tenantId, "3201");
    const journalLines: Array<{ accountId: string; debit: number; credit: number }> = [];
    for (const row of byAccount.values()) {
      if (row.classCode === "4") {
        const net = row.credit - row.debit;
        if (Math.abs(net) < 0.01) continue;
        if (net > 0) journalLines.push({ accountId: row.id, debit: net, credit: 0 }, { accountId: shu.id, debit: 0, credit: net });
        else journalLines.push({ accountId: shu.id, debit: -net, credit: 0 }, { accountId: row.id, debit: 0, credit: -net });
      } else {
        const net = row.debit - row.credit;
        if (Math.abs(net) < 0.01) continue;
        if (net > 0) journalLines.push({ accountId: shu.id, debit: net, credit: 0 }, { accountId: row.id, debit: 0, credit: net });
        else journalLines.push({ accountId: row.id, debit: -net, credit: 0 }, { accountId: shu.id, debit: 0, credit: -net });
      }
    }
    if (journalLines.length < 2) {
      throw new BadRequestException({ message: `Tidak ada mutasi PHU di tahun ${year} untuk ditutup` });
    }
    const journal = await this.post(
      tenantId,
      { postedOn, memo: `Tutup buku PHU ${year}`, sourceType: "year.close", sourceId: `year-${year}`, lines: journalLines },
      actorId,
    );
    await this.prisma.db.yearClose.create({
      data: { tenantId, year, phuNet: preview.phuNet, closeJournalId: journal.id, closedBy: actorId },
    });
    return this.yearClosePreview(tenantId, year);
  }

  async allocateYear(tenantId: string, year: number, actorId?: string) {
    const preview = await this.yearClosePreview(tenantId, year);
    if (!preview.closed) throw new BadRequestException({ message: `Tutup buku tahun ${year} dulu sebelum alokasi SHU` });
    if (preview.allocated) throw new ConflictException({ message: `SHU ${year} sudah dialokasi` });
    if (preview.phuNet <= 0) throw new BadRequestException({ message: "SHU nol atau rugi — tidak ada yang dialokasi" });
    const postedOn = `${year}-12-31`;
    await this.ensurePeriod(tenantId, year, 12);
    const shu = await this.accountByCode(tenantId, "3201");
    const parts = allocateShu(preview.phuNet, preview.shares);
    const lines = [{ accountId: shu.id, debit: preview.phuNet, credit: 0 }];
    for (const part of parts) {
      if (part.amount <= 0) continue;
      const account = await this.accountByCode(tenantId, part.accountCode);
      lines.push({ accountId: account.id, debit: 0, credit: part.amount });
    }
    const journal = await this.post(
      tenantId,
      { postedOn, memo: `Alokasi SHU ${year}`, sourceType: "shu.allocate", sourceId: `shu-${year}`, lines },
      actorId,
    );
    await this.prisma.db.yearClose.update({
      where: { tenantId_year: { tenantId, year } },
      data: { allocateJournalId: journal.id, allocatedAt: new Date() },
    });
    return this.yearClosePreview(tenantId, year);
  }

  async voidYearClose(tenantId: string, year: number, actorId?: string) {
    const existing = await this.prisma.db.yearClose.findUnique({ where: { tenantId_year: { tenantId, year } } });
    if (!existing) throw new NotFoundException({ message: `Tahun ${year} belum ditutup` });
    if (existing.allocateJournalId) {
      await this.reverse(tenantId, existing.allocateJournalId, actorId, { fromOperation: true });
    }
    if (existing.closeJournalId) {
      await this.reverse(tenantId, existing.closeJournalId, actorId, { fromOperation: true });
    }
    await this.prisma.db.yearClose.delete({ where: { id: existing.id } });
    await this.audit.record({ action: "ledger.year.reopened", resource: "year-close", tenantId, actorId, metadata: { year } });
    return this.yearClosePreview(tenantId, year);
  }
}
