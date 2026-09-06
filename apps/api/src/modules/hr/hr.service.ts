import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ERROR_CODES } from "@mankopi/shared";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { LedgerService } from "../ledger/ledger.service";

function n(v: Prisma.Decimal | number | string | null | undefined) {
  return Number(v ?? 0);
}

function netOf(base: number, allowance: number, deduction: number) {
  const net = Math.round((base + allowance - deduction) * 100) / 100;
  if (base < 0 || allowance < 0 || deduction < 0) {
    throw new BadRequestException({ message: "Nominal gaji tidak boleh negatif" });
  }
  if (net < 0) throw new BadRequestException({ message: "Potongan melebihi gaji + tunjangan" });
  return net;
}

const employeeInclude = {
  branch: { select: { id: true, code: true, name: true } },
  unit: { select: { id: true, code: true, name: true, branchId: true } },
} as const;

const runInclude = {
  items: { include: { employee: { select: { id: true, employeeNo: true } } }, orderBy: { employeeName: "asc" as const } },
};

@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
  ) {}

  listEmployees(tenantId: string) {
    return this.prisma.db.employee.findMany({
      where: { tenantId },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: employeeInclude,
    });
  }

  async createEmployee(
    tenantId: string,
    input: {
      name: string;
      nik?: string;
      phone?: string;
      position?: string;
      baseSalary: number;
      allowance?: number;
      branchId?: string;
      unitId?: string | null;
      joinedOn?: string;
    },
    actorId?: string,
  ) {
    if (!input.name.trim()) throw new BadRequestException({ message: "Nama pegawai wajib diisi" });
    const baseSalary = Number(input.baseSalary);
    const allowance = Number(input.allowance ?? 0);
    netOf(baseSalary, allowance, 0);
    const office = await this.resolveOffice(tenantId, input.branchId, input.unitId);
    const seq = (await this.prisma.db.employee.count({ where: { tenantId } })) + 1;
    const employee = await this.prisma.db.employee.create({
      data: {
        tenantId,
        employeeNo: `PGW-${String(seq).padStart(4, "0")}`,
        name: input.name.trim(),
        nik: input.nik?.trim() || null,
        phone: input.phone?.trim() || null,
        position: input.position?.trim() || null,
        baseSalary,
        allowance,
        branchId: office.branchId,
        unitId: office.unitId,
        joinedOn: input.joinedOn ? new Date(`${input.joinedOn}T00:00:00Z`) : undefined,
      },
      include: employeeInclude,
    });
    await this.audit.record({ action: "hr.employee.created", resource: "employee", resourceId: employee.id, tenantId, actorId });
    return employee;
  }

  async updateEmployee(
    tenantId: string,
    id: string,
    input: {
      name?: string;
      nik?: string | null;
      phone?: string | null;
      position?: string | null;
      baseSalary?: number;
      allowance?: number;
      branchId?: string;
      unitId?: string | null;
      status?: "ACTIVE" | "DISABLED";
      joinedOn?: string | null;
    },
    actorId?: string,
  ) {
    const current = await this.prisma.db.employee.findFirst({ where: { id, tenantId } });
    if (!current) throw new NotFoundException({ message: "Pegawai tidak ditemukan" });
    const baseSalary = input.baseSalary === undefined ? n(current.baseSalary) : Number(input.baseSalary);
    const allowance = input.allowance === undefined ? n(current.allowance) : Number(input.allowance);
    netOf(baseSalary, allowance, 0);
    const office =
      input.branchId !== undefined || input.unitId !== undefined
        ? await this.resolveOffice(tenantId, input.branchId ?? current.branchId ?? undefined, input.unitId)
        : { branchId: current.branchId, unitId: current.unitId };
    const employee = await this.prisma.db.employee.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        nik: input.nik === undefined ? undefined : input.nik?.trim() || null,
        phone: input.phone === undefined ? undefined : input.phone?.trim() || null,
        position: input.position === undefined ? undefined : input.position?.trim() || null,
        baseSalary,
        allowance,
        branchId: office.branchId,
        unitId: office.unitId,
        status: input.status,
        joinedOn: input.joinedOn === undefined ? undefined : input.joinedOn ? new Date(`${input.joinedOn}T00:00:00Z`) : null,
      },
      include: employeeInclude,
    });
    await this.audit.record({ action: "hr.employee.updated", resource: "employee", resourceId: id, tenantId, actorId });
    return employee;
  }

  listPayrolls(tenantId: string) {
    return this.prisma.db.payrollRun.findMany({
      where: { tenantId },
      orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
      include: { items: true },
    });
  }

  getPayroll(tenantId: string, id: string) {
    return this.prisma.db.payrollRun.findFirst({
      where: { id, tenantId },
      include: runInclude,
    });
  }

  async createPayroll(
    tenantId: string,
    input: { year: number; month: number; paidOn?: string; cashAccountCode?: string; memo?: string },
    actorId?: string,
  ) {
    const year = Number(input.year);
    const month = Number(input.month);
    if (!Number.isInteger(year) || month < 1 || month > 12) {
      throw new BadRequestException({ message: "Periode payroll tidak valid" });
    }
    const existing = await this.prisma.db.payrollRun.findFirst({
      where: { tenantId, year, month, status: { in: ["DRAFT", "POSTED"] } },
    });
    if (existing?.status === "POSTED") {
      throw new ConflictException({
        code: ERROR_CODES.CONFLICT,
        message: "Payroll bulan ini sudah diposting. Batalkan dulu jika ingin mengulang.",
      });
    }
    if (existing?.status === "DRAFT") {
      throw new ConflictException({
        code: ERROR_CODES.CONFLICT,
        message: "Draft payroll bulan ini sudah ada. Buka dari riwayat periode.",
      });
    }
    const employees = await this.prisma.db.employee.findMany({
      where: { tenantId, status: "ACTIVE" },
      orderBy: { name: "asc" },
    });
    if (!employees.length) {
      throw new BadRequestException({ message: "Belum ada pegawai aktif. Isi Personalia dulu." });
    }
    const paidOn = input.paidOn ?? new Date().toISOString().slice(0, 10);
    const cashAccountCode = input.cashAccountCode === "1102" ? "1102" : "1101";
    const run = await this.prisma.db.payrollRun.create({
      data: {
        tenantId,
        year,
        month,
        paidOn: new Date(`${paidOn}T00:00:00Z`),
        cashAccountCode,
        memo: input.memo?.trim() || `Gaji personalia ${String(month).padStart(2, "0")}/${year}`,
        items: {
          create: employees.map((e) => {
            const baseSalary = n(e.baseSalary);
            const allowance = n(e.allowance);
            return {
              tenantId,
              employeeId: e.id,
              employeeName: e.name,
              position: e.position,
              baseSalary,
              allowance,
              deduction: 0,
              net: netOf(baseSalary, allowance, 0),
            };
          }),
        },
      },
      include: runInclude,
    });
    await this.audit.record({ action: "hr.payroll.drafted", resource: "payroll", resourceId: run.id, tenantId, actorId });
    return run;
  }

  async updatePayrollItem(
    tenantId: string,
    runId: string,
    itemId: string,
    input: { baseSalary?: number; allowance?: number; deduction?: number },
    actorId?: string,
  ) {
    const run = await this.requireDraft(tenantId, runId);
    const item = run.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException({ message: "Baris payroll tidak ditemukan" });
    const baseSalary = input.baseSalary === undefined ? n(item.baseSalary) : Number(input.baseSalary);
    const allowance = input.allowance === undefined ? n(item.allowance) : Number(input.allowance);
    const deduction = input.deduction === undefined ? n(item.deduction) : Number(input.deduction);
    const net = netOf(baseSalary, allowance, deduction);
    const updated = await this.prisma.db.payrollItem.update({
      where: { id: itemId },
      data: { baseSalary, allowance, deduction, net },
    });
    await this.audit.record({ action: "hr.payroll.item_updated", resource: "payroll", resourceId: runId, tenantId, actorId });
    return updated;
  }

  async submitPayroll(tenantId: string, runId: string, actorId?: string) {
    const run = await this.requireDraft(tenantId, runId);
    if (!run.items.length) throw new BadRequestException({ message: "Payroll kosong" });
    const gross = run.items.reduce((s, i) => s + n(i.baseSalary) + n(i.allowance), 0);
    const deduction = run.items.reduce((s, i) => s + n(i.deduction), 0);
    const net = run.items.reduce((s, i) => s + n(i.net), 0);
    if (gross <= 0) throw new BadRequestException({ message: "Total gaji harus lebih dari 0" });
    const expense = await this.ledger.accountByCode(tenantId, "5102");
    const cash = await this.ledger.accountByCode(tenantId, run.cashAccountCode);
    const lines = [
      { accountId: expense.id, debit: gross, credit: 0, memo: "Beban gaji personalia" },
      { accountId: cash.id, debit: 0, credit: net, memo: "Pembayaran gaji" },
    ];
    if (deduction > 0) {
      const payable = await this.ledger.accountByCode(tenantId, "2102");
      lines.push({ accountId: payable.id, debit: 0, credit: deduction, memo: "Potongan gaji" });
    }
    const paidOn = run.paidOn.toISOString().slice(0, 10);
    const journal = await this.ledger.postFromSource(
      tenantId,
      {
        postedOn: paidOn,
        memo: run.memo ?? `Payroll ${run.month}/${run.year}`,
        sourceType: "payroll.salary",
        sourceId: run.id,
        lines,
      },
      actorId,
    );
    const posted = await this.prisma.db.payrollRun.update({
      where: { id: run.id },
      data: { status: "POSTED", journalId: journal.id },
      include: runInclude,
    });
    await this.audit.record({ action: "hr.payroll.posted", resource: "payroll", resourceId: run.id, tenantId, actorId });
    return posted;
  }

  async voidPayroll(tenantId: string, runId: string, actorId?: string) {
    const run = await this.prisma.db.payrollRun.findFirst({ where: { id: runId, tenantId }, include: runInclude });
    if (!run) throw new NotFoundException({ message: "Payroll tidak ditemukan" });
    if (run.status !== "POSTED") throw new ConflictException({ message: "Hanya payroll yang sudah diposting yang bisa dibatalkan" });
    if (run.journalId) {
      await this.ledger.reverse(tenantId, run.journalId, actorId, { fromOperation: true });
    }
    const voided = await this.prisma.db.payrollRun.update({
      where: { id: run.id },
      data: { status: "VOIDED" },
      include: runInclude,
    });
    await this.audit.record({ action: "hr.payroll.voided", resource: "payroll", resourceId: run.id, tenantId, actorId });
    return voided;
  }

  private async requireDraft(tenantId: string, runId: string) {
    const run = await this.prisma.db.payrollRun.findFirst({ where: { id: runId, tenantId }, include: runInclude });
    if (!run) throw new NotFoundException({ message: "Payroll tidak ditemukan" });
    if (run.status !== "DRAFT") throw new ConflictException({ message: "Payroll ini sudah dikunci" });
    return run;
  }

  private async resolveOffice(tenantId: string, branchId?: string, unitId?: string | null) {
    let branch = branchId ? await this.prisma.db.branch.findFirst({ where: { id: branchId, tenantId } }) : null;
    if (!branch && unitId) {
      const unit = await this.prisma.db.unit.findFirst({ where: { id: unitId, tenantId }, include: { branch: true } });
      if (unit) branch = unit.branch;
    }
    if (!branch) {
      branch =
        (await this.prisma.db.branch.findFirst({ where: { tenantId, status: "ACTIVE", code: "HQ" } })) ??
        (await this.prisma.db.branch.findFirst({ where: { tenantId, status: "ACTIVE" }, orderBy: { createdAt: "asc" } }));
    }
    if (!unitId) return { branchId: branch?.id ?? null, unitId: null as string | null };
    const unit = await this.prisma.db.unit.findFirst({ where: { id: unitId, tenantId, branchId: branch?.id } });
    if (!unit) throw new BadRequestException({ message: "Unit tidak termasuk cabang yang dipilih" });
    return { branchId: branch!.id, unitId: unit.id };
  }
}
