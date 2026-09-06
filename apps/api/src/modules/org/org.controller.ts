import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import type { AuthUser } from "@mankopi/shared";
import { CurrentUser, RequirePermissions } from "../../common/decorators";
import { OrgService } from "./org.service";

@Controller("org")
export class OrgController {
  constructor(private readonly org: OrgService) {}

  @Get("branches")
  @RequirePermissions("org:branch:view")
  branches(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string) {
    const id = user.isPlatformAdmin ? tenantId ?? undefined : user.tenantId ?? undefined;
    return this.org.listBranches(id);
  }

  @Post("branches")
  @RequirePermissions("org:branch:manage")
  createBranch(
    @CurrentUser() user: AuthUser,
    @Body() body: { code: string; name: string; address?: string; phone?: string; tenantId?: string },
  ) {
    const tenantId = user.isPlatformAdmin ? body.tenantId ?? user.tenantId : user.tenantId;
    if (!tenantId) {
      throw new BadRequestException({
        code: "VALIDATION_FAILED",
        message: "Pilih konteks koperasi di sidebar sebelum menambah cabang",
      });
    }
    return this.org.createBranch({ ...body, tenantId });
  }

  @Patch("branches/:id")
  @RequirePermissions("org:branch:manage")
  updateBranch(
    @Param("id") id: string,
    @Body() body: { name?: string; address?: string; phone?: string; status?: string },
  ) {
    return this.org.updateBranch(id, body);
  }

  @Get("units")
  @RequirePermissions("org:branch:view")
  units(@CurrentUser() user: AuthUser, @Query("branchId") branchId?: string) {
    if (!user.tenantId && !user.isPlatformAdmin) return [];
    return this.org.listUnits(user.tenantId!, branchId);
  }

  @Post("units")
  @RequirePermissions("org:branch:manage")
  createUnit(
    @CurrentUser() user: AuthUser,
    @Body() body: { branchId: string; code: string; name: string },
  ) {
    return this.org.createUnit({ ...body, tenantId: user.tenantId ?? undefined });
  }

  @Patch("units/:id")
  @RequirePermissions("org:branch:manage")
  updateUnit(@Param("id") id: string, @Body() body: { name?: string; status?: string }) {
    return this.org.updateUnit(id, body);
  }
}
