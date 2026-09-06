import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ERROR_CODES, type AuthUser } from "@mankopi/shared";
import { IS_PUBLIC } from "./decorators";

export type JwtPayload = AuthUser & { typ: "access" };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || context.getType() !== "http") return true;

    const req = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: AuthUser }>();
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHENTICATED, message: "Token diperlukan" });
    }
    try {
      const payload = this.jwt.verify<JwtPayload>(token);
      if (payload.typ !== "access") throw new Error("wrong type");
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException({ code: ERROR_CODES.UNAUTHENTICATED, message: "Token tidak valid" });
    }
  }
}
