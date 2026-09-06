import { Controller, Get, Query } from "@nestjs/common";
import { CurrentUser, RequirePermissions } from "../../common/decorators";
import type { AuthUser } from "@mankopi/shared";
import { AuditService } from "./audit.service";

@Controller("audit")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions("audit:view")
  list(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string) {
    const scope = user.isPlatformAdmin ? tenantId : user.tenantId ?? undefined;
    return this.audit.list(scope);
  }
}
