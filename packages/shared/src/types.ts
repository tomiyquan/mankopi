import type { DataScope, TenantStatus, UserStatus } from "./enums.js";
import type { PermissionKey } from "./permissions.js";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  tenantId: string | null;
  tenantSlug: string | null;
  status: UserStatus;
  isPlatformAdmin: boolean;
  permissions: PermissionKey[];
  scope: DataScope;
  branchId: string | null;
  unitId: string | null;
};

export type TenantSummary = {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  plan: string;
};

export type HealthStatus = {
  status: "ok" | "degraded";
  service: "api" | "worker";
  timestamp: string;
};
