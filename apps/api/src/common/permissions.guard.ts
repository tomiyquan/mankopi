import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ERROR_CODES, type PermissionKey } from "@mankopi/shared";
import { PERMISSIONS_KEY } from "./decorators";
import type { AuthUser } from "@mankopi/shared";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const needed = this.reflector.getAllAndOverride<PermissionKey[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!needed?.length) return true;
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: "Hak akses tidak cukup" });
    }
    const ok = needed.every((key) => user.permissions.includes(key));
    if (!ok) {
      throw new ForbiddenException({ code: ERROR_CODES.FORBIDDEN, message: "Hak akses tidak cukup" });
    }
    return true;
  }
}
