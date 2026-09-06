import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { optionalStore } from "../../common/request-context";
import { PrismaService } from "../../prisma/prisma.service";

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

  list(tenantId?: string) {
    return this.prisma.db.auditLog.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
  }
}
