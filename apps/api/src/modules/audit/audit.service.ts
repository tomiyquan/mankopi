import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { optionalStore } from "../../common/request-context";
import { PrismaService } from "../../prisma/prisma.service";
import { auditListWhere, parseAuditPage, parseAuditPageSize } from "./audit-query";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    action: string;
    resource: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    tenantId?: string | null;
    actorId?: string | null;
  }) {
    const ctx = optionalStore();
    await this.prisma.db.auditLog.create({
      data: {
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        tenantId: input.tenantId ?? ctx?.user?.tenantId ?? ctx?.tenantId ?? null,
        actorId: input.actorId ?? ctx?.user?.id ?? null,
        ip: ctx?.ip,
        userAgent: ctx?.userAgent,
      },
    });
  }

  async list(input: { tenantId?: string; q?: string; page?: string; pageSize?: string }) {
    const page = parseAuditPage(input.page);
    const pageSize = parseAuditPageSize(input.pageSize);
    const where = auditListWhere(input.tenantId, input.q);
    const [items, total] = await Promise.all([
      this.prisma.db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.db.auditLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
}
