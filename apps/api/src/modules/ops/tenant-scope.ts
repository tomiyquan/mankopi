import { BadRequestException } from "@nestjs/common";
import type { AuthUser } from "@mankopi/shared";
import { ERROR_CODES } from "@mankopi/shared";

export function scopeTenant(user: AuthUser, tenantId?: string) {
  const id = user.isPlatformAdmin ? tenantId : user.tenantId ?? undefined;
  if (!id) {
    throw new BadRequestException({
      code: ERROR_CODES.TENANT_REQUIRED,
      message: "Pilih konteks koperasi",
    });
  }
  return id;
}
