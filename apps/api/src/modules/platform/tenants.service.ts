import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ERROR_CODES } from "@mankopi/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { IdentityService } from "../identity/identity.service";
import { OperationsService } from "../ops/operations.service";

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly ops: OperationsService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.db.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true, branches: true } } },
    });
  }

  async create(input: { slug: string; name: string; legalName?: string; plan?: string }) {
    const slug = input.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const exists = await this.prisma.db.tenant.findUnique({ where: { slug } });
    if (exists) {
      throw new ConflictException({ code: ERROR_CODES.CONFLICT, message: "Slug koperasi sudah dipakai" });
    }
    const tenant = await this.prisma.db.tenant.create({
      data: {
        slug,
        name: input.name,
        legalName: input.legalName,
        plan: input.plan ?? "standard",
        status: "TRIAL",
        branches: {
          create: { code: "HQ", name: "Kantor Pusat", status: "ACTIVE" },
        },
      },
    });
    await this.identity.provisionTenantRoles(tenant.id);
    await this.ops.provisionMaster(tenant.id);
    await this.audit.record({
      action: "platform.tenant.created",
      resource: "tenant",
      resourceId: tenant.id,
      tenantId: tenant.id,
    });
    return tenant;
  }

  async update(
    id: string,
    input: { name?: string; legalName?: string; status?: "TRIAL" | "ACTIVE" | "SUSPENDED"; plan?: string },
  ) {
    const tenant = await this.prisma.db.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException({ code: ERROR_CODES.TENANT_NOT_FOUND, message: "Koperasi tidak ditemukan" });
    }
    const updated = await this.prisma.db.tenant.update({ where: { id }, data: input });
    await this.audit.record({
      action: "platform.tenant.updated",
      resource: "tenant",
      resourceId: id,
      tenantId: id,
      metadata: { status: updated.status, plan: updated.plan },
    });
    return updated;
  }

  async summary(scopeTenantId?: string) {
    const where = scopeTenantId ? { tenantId: scopeTenantId } : undefined;
    const [tenants, users, branches, suspended, recentAudit] = await Promise.all([
      scopeTenantId
        ? 1
        : this.prisma.db.tenant.count(),
      this.prisma.db.user.count({ where: scopeTenantId ? { tenantId: scopeTenantId } : undefined }),
      this.prisma.db.branch.count({ where }),
      scopeTenantId
        ? this.prisma.db.tenant.count({ where: { id: scopeTenantId, status: "SUSPENDED" } })
        : this.prisma.db.tenant.count({ where: { status: "SUSPENDED" } }),
      this.prisma.db.auditLog.findMany({
        where: scopeTenantId ? { tenantId: scopeTenantId } : undefined,
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { actor: { select: { name: true } } },
      }),
    ]);
    const tenant = scopeTenantId
      ? await this.prisma.db.tenant.findUnique({
          where: { id: scopeTenantId },
          select: { id: true, name: true, slug: true, status: true, plan: true, legalName: true },
        })
      : null;
    const ops = scopeTenantId ? await this.ops.overview(scopeTenantId) : null;
    return { tenants, users, branches, suspended, recentAudit, tenant, ops };
  }
}
