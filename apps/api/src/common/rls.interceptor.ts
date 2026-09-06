import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { from, lastValueFrom } from "rxjs";
import { PrismaService } from "../prisma/prisma.service";
import { requestContext } from "./request-context";

const PUBLIC_AUTH = ["/auth/login", "/auth/refresh"];

@Injectable()
export class RlsInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<{
      url?: string;
      raw?: { url?: string };
      user?: { tenantId: string | null; isPlatformAdmin: boolean };
      headers: Record<string, string | string[] | undefined>;
      ip?: string;
    }>();

    const path = req.url ?? req.raw?.url ?? "";
    const publicAuth = PUBLIC_AUTH.some((p) => path.includes(p));

    return from(
      this.prisma.$transaction(async (tx) => {
        const bypass = Boolean(req.user?.isPlatformAdmin) || publicAuth;
        const tenantId = req.user?.tenantId ?? "";

        await tx.$executeRaw`SELECT set_config('app.bypass_rls', ${bypass ? "on" : "off"}, true)`;
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;

        return requestContext.run(
          {
            tx,
            bypassRls: bypass,
            tenantId: tenantId || undefined,
            ip: req.ip,
            userAgent: String(req.headers["user-agent"] ?? ""),
          },
          () => lastValueFrom(next.handle()),
        );
      }),
    );
  }
}
