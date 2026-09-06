import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import type { AuthUser } from "@mankopi/shared";
import { CurrentUser, RequirePermissions } from "../../common/decorators";
import { TenantsService } from "./tenants.service";

@Controller("platform")
export class PlatformController {
  constructor(private readonly tenants: TenantsService) {}

  @Get("summary")
  summary(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string) {
    return this.tenants.summary(user.isPlatformAdmin ? tenantId : user.tenantId ?? undefined);
  }

  @Get("tenants")
  @RequirePermissions("platform:tenant:manage")
  list() {
    return this.tenants.list();
  }

  @Post("tenants")
  @RequirePermissions("platform:tenant:manage")
  create(@Body() body: { slug: string; name: string; legalName?: string; plan?: string }) {
    return this.tenants.create(body);
  }

  @Patch("tenants/:id")
  @RequirePermissions("platform:tenant:manage")
  update(
    @Param("id") id: string,
    @Body() body: { name?: string; legalName?: string; status?: "TRIAL" | "ACTIVE" | "SUSPENDED"; plan?: string },
  ) {
    return this.tenants.update(id, body);
  }
}
