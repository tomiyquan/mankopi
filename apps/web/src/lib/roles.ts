import { ROLE_META } from "@mankopi/shared";
import type { RoleRow } from "./api";

export function isTemplateRole(role: Pick<RoleRow, "tenantId" | "layer">) {
  return role.tenantId === null && role.layer === "TENANT";
}

export function roleLabel(role: Pick<RoleRow, "slug" | "name">) {
  const meta = ROLE_META[role.slug];
  if (meta?.isTenantAdmin) return `${role.name} — admin koperasi`;
  return role.name;
}

/** Peran yang dipakai operasional — cetakan platform disembunyikan. */
export function operationalRoles(roles: RoleRow[], tenantId: string | null, isPlatformAdmin: boolean) {
  return roles.filter((role) => {
    if (isTemplateRole(role)) return false;
    if (!isPlatformAdmin) return role.tenantId === tenantId;
    if (tenantId) return role.tenantId === tenantId;
    return role.layer === "PLATFORM";
  });
}
