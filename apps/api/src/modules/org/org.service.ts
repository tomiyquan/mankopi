import { ConflictException, Injectable } from "@nestjs/common";
import { ERROR_CODES } from "@mankopi/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

function emptyBranchStats() {
  return {
    members: 0,
    disbursedTotal: 0,
    activeCount: 0,
    activeOutstanding: 0,
    lancarCount: 0,
    lancarOutstanding: 0,
    macetCount: 0,
    macetOutstanding: 0,
  };
}

@Injectable()
export class OrgService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listBranches(tenantId?: string) {
    const branches = await this.prisma.db.branch.findMany({
      where: tenantId ? { tenantId } : undefined,
      include: { units: true, tenant: { select: { id: true, name: true, slug: true } } },
      orderBy: [{ tenantId: "asc" }, { code: "asc" }],
    });
    if (branches.length === 0) return branches;

    const branchIds = branches.map((b) => b.id);
    const [memberGroups, loans] = await Promise.all([
      this.prisma.db.member.groupBy({
        by: ["branchId"],
        where: { status: "ACTIVE", branchId: { in: branchIds } },
        _count: { _all: true },
      }),
      this.prisma.db.loan.findMany({
        where: {
          status: { in: ["DISBURSED", "CLOSED"] },
          member: { branchId: { in: branchIds } },
        },
        select: {
          principal: true,
          outstandingPrincipal: true,
          status: true,
          collectability: true,
          member: { select: { branchId: true } },
        },
      }),
    ]);

    const memberCount = new Map(memberGroups.map((row) => [row.branchId, row._count._all]));
    const stats = new Map(branchIds.map((id) => [id, emptyBranchStats()]));
    for (const loan of loans) {
      const branchId = loan.member.branchId;
      if (!branchId) continue;
      const row = stats.get(branchId);
      if (!row) continue;
      row.disbursedTotal += Number(loan.principal ?? 0);
      if (loan.status !== "DISBURSED") continue;
      const outstanding = Number(loan.outstandingPrincipal ?? 0);
      row.activeCount += 1;
      row.activeOutstanding += outstanding;
      if (loan.collectability === 1) {
        row.lancarCount += 1;
        row.lancarOutstanding += outstanding;
      }
      if (loan.collectability === 5) {
        row.macetCount += 1;
        row.macetOutstanding += outstanding;
      }
    }

    return branches.map((branch) => ({
      ...branch,
      stats: {
        ...(stats.get(branch.id) ?? emptyBranchStats()),
        members: memberCount.get(branch.id) ?? 0,
      },
    }));
  }

  async createBranch(input: { tenantId: string; code: string; name: string; address?: string; phone?: string }) {
    const exists = await this.prisma.db.branch.findUnique({
      where: { tenantId_code: { tenantId: input.tenantId, code: input.code } },
    });
    if (exists) {
      throw new ConflictException({ code: ERROR_CODES.CONFLICT, message: "Kode cabang sudah ada" });
    }
    const branch = await this.prisma.db.branch.create({ data: input });
    await this.audit.record({
      action: "org.branch.created",
      resource: "branch",
      resourceId: branch.id,
      tenantId: input.tenantId,
    });
    return branch;
  }

  async updateBranch(id: string, data: { name?: string; address?: string; phone?: string; status?: string }) {
    const branch = await this.prisma.db.branch.update({ where: { id }, data });
    await this.audit.record({
      action: "org.branch.updated",
      resource: "branch",
      resourceId: id,
      tenantId: branch.tenantId,
    });
    return branch;
  }

  listUnits(tenantId: string, branchId?: string) {
    return this.prisma.db.unit.findMany({
      where: { tenantId, branchId },
      orderBy: { code: "asc" },
    });
  }

  async createUnit(input: { tenantId?: string; branchId: string; code: string; name: string }) {
    const branch = await this.prisma.db.branch.findUnique({ where: { id: input.branchId } });
    if (!branch) {
      throw new ConflictException({ code: ERROR_CODES.CONFLICT, message: "Cabang tidak ditemukan" });
    }
    const unit = await this.prisma.db.unit.create({
      data: {
        tenantId: input.tenantId ?? branch.tenantId,
        branchId: input.branchId,
        code: input.code,
        name: input.name,
      },
    });
    await this.audit.record({
      action: "org.unit.created",
      resource: "unit",
      resourceId: unit.id,
      tenantId: unit.tenantId,
    });
    return unit;
  }

  async updateUnit(id: string, data: { name?: string; status?: string }) {
    const unit = await this.prisma.db.unit.update({ where: { id }, data });
    await this.audit.record({
      action: "org.unit.updated",
      resource: "unit",
      resourceId: id,
      tenantId: unit.tenantId,
    });
    return unit;
  }
}
