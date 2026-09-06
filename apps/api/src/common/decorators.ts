import { SetMetadata, createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { PermissionKey } from "@mankopi/shared";
import type { AuthUser } from "@mankopi/shared";

export const IS_PUBLIC = "isPublic";
export const PERMISSIONS_KEY = "permissions";

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const RequirePermissions = (...keys: PermissionKey[]) => SetMetadata(PERMISSIONS_KEY, keys);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});
