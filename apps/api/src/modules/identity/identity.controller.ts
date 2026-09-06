import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { ERROR_CODES, type AuthUser, type DataScope, type PermissionKey } from "@mankopi/shared";
import { PERMISSIONS } from "@mankopi/shared";
import { CurrentUser, Public, RequirePermissions } from "../../common/decorators";
import { IdentityService } from "./identity.service";

@Controller()
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Public()
  @Post("auth/login")
  login(
    @Body() body: { email: string; password: string },
    @CurrentUser() _user: AuthUser | undefined,
  ) {
    return this.identity.login(body.email, body.password, {});
  }

  @Public()
  @Post("auth/refresh")
  refresh(@Body() body: { refreshToken: string }) {
    return this.identity.refresh(body.refreshToken, {});
  }

  @Public()
  @Post("auth/logout")
  logout(@Body() body: { refreshToken?: string }) {
    return this.identity.logout(body.refreshToken);
  }

  @Get("auth/me")
  me(@CurrentUser() user: AuthUser) {
    return this.identity.snapshot(user.id);
  }

  @Post("auth/reissue")
  reissue(@CurrentUser() user: AuthUser) {
    return this.identity.reissue(user.id);
  }

  @Get("meta/permissions")
  permissions() {
    return PERMISSIONS;
  }

  @Get("identity/users")
  @RequirePermissions("identity:user:manage")
  users(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string) {
    return this.identity.listUsers(user.isPlatformAdmin ? tenantId : user.tenantId ?? undefined);
  }

  @Post("identity/users")
  @RequirePermissions("identity:user:manage")
  createUser(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      email: string;
      name: string;
      password: string;
      roleId: string;
      scope: DataScope;
      tenantId?: string;
      branchId?: string;
      unitId?: string;
      phone?: string;
    },
  ) {
    return this.identity.createUser({
      ...body,
      tenantId: user.isPlatformAdmin ? body.tenantId ?? user.tenantId : user.tenantId,
    });
  }

  @Patch("identity/users/:id")
  @RequirePermissions("identity:user:manage")
  updateUser(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { name?: string; phone?: string | null },
  ) {
    return this.identity.updateUser(id, body, user.id);
  }

  @Patch("identity/users/:id/status")
  @RequirePermissions("identity:user:manage")
  setStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { status: "ACTIVE" | "DISABLED" },
  ) {
    return this.identity.setUserStatus(id, body.status, user.id);
  }

  @Post("identity/users/:id/reset-password")
  @RequirePermissions("identity:user:manage")
  resetPassword(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { password: string },
  ) {
    return this.identity.resetPassword(id, body.password, user.id);
  }

  @Put("identity/users/:id/membership")
  @RequirePermissions("identity:user:manage")
  setMembership(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: { roleId: string; scope: DataScope; branchId?: string; unitId?: string },
  ) {
    return this.identity.setMembership(id, body, user.id);
  }

  @Get("identity/roles")
  roles(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string) {
    const canRead =
      user.permissions.includes("identity:role:manage") || user.permissions.includes("identity:user:manage");
    if (!canRead) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: "Hak akses tidak cukup" });
    }
    if (user.isPlatformAdmin) {
      return tenantId
        ? this.identity.listRoles({ tenantId })
        : this.identity.listRoles({ platformOnly: true });
    }
    return this.identity.listRoles({ tenantId: user.tenantId });
  }

  @Put("identity/roles/:id/permissions")
  @RequirePermissions("identity:role:manage")
  setPermissions(@Param("id") id: string, @Body() body: { keys: PermissionKey[] }) {
    return this.identity.setRolePermissions(id, body.keys);
  }

  @Post("identity/roles/:id/reset")
  @RequirePermissions("identity:role:manage")
  resetPermissions(@Param("id") id: string) {
    return this.identity.resetRolePermissions(id);
  }
}
