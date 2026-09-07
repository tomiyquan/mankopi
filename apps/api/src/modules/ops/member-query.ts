import type { Prisma } from "@prisma/client";

export const MEMBER_PAGE_SIZE_DEFAULT = 20;
export const MEMBER_PAGE_SIZE_MAX = 100;

export function parseMemberPage(value?: string | number) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export function parseMemberPageSize(value?: string | number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return MEMBER_PAGE_SIZE_DEFAULT;
  return Math.min(MEMBER_PAGE_SIZE_MAX, Math.floor(n));
}

export function parseMemberStatus(value?: string) {
  const status = value?.trim().toUpperCase();
  return status === "ACTIVE" || status === "LEFT" ? status : undefined;
}

export function memberListWhere(tenantId: string, q?: string, status?: string): Prisma.MemberWhereInput {
  const term = q?.trim();
  const memberStatus = parseMemberStatus(status);
  const search: Prisma.MemberWhereInput | undefined = term
    ? {
        OR: [
          { memberNo: { contains: term, mode: "insensitive" } },
          { nik: { contains: term, mode: "insensitive" } },
          { name: { contains: term, mode: "insensitive" } },
          { phone: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
          { occupation: { contains: term, mode: "insensitive" } },
        ],
      }
    : undefined;
  return {
    tenantId,
    ...(memberStatus ? { status: memberStatus } : {}),
    ...search,
  };
}
