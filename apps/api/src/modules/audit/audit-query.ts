import type { Prisma } from "@prisma/client";

export const AUDIT_PAGE_SIZE_DEFAULT = 20;
export const AUDIT_PAGE_SIZE_MAX = 100;

export function parseAuditPage(value?: string | number) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function parseAuditPageSize(value?: string | number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return AUDIT_PAGE_SIZE_DEFAULT;
  return Math.min(AUDIT_PAGE_SIZE_MAX, Math.floor(n));
}

export function auditListWhere(tenantId?: string, q?: string): Prisma.AuditLogWhereInput {
  const term = q?.trim();
  const search: Prisma.AuditLogWhereInput | undefined = term
    ? {
        OR: [
          { action: { contains: term, mode: "insensitive" } },
          { resource: { contains: term, mode: "insensitive" } },
          { resourceId: { contains: term, mode: "insensitive" } },
          { actor: { name: { contains: term, mode: "insensitive" } } },
          { actor: { email: { contains: term, mode: "insensitive" } } },
        ],
      }
    : undefined;
  return {
    ...(tenantId ? { tenantId } : {}),
    ...search,
  };
}
