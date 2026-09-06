import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from "@nestjs/core";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { AuthGuard } from "./common/auth.guard";
import { HttpExceptionFilter } from "./common/http-exception.filter";
import { PermissionsGuard } from "./common/permissions.guard";
import { RlsInterceptor } from "./common/rls.interceptor";
import { AuditModule } from "./modules/audit/audit.module";
import { HealthController } from "./modules/health/health.controller";
import { IdentityModule } from "./modules/identity/identity.module";
import { LedgerModule } from "./modules/ledger/ledger.module";
import { HrModule } from "./modules/hr/hr.module";
import { OperationsModule } from "./modules/ops/operations.module";
import { OrgModule } from "./modules/org/org.module";
import { PlatformModule } from "./modules/platform/platform.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { PrismaModule } from "./prisma/prisma.module";
import { PrismaService } from "./prisma/prisma.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env", "../../.env"] }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? "change-me-to-a-long-random-string",
      signOptions: { expiresIn: process.env.JWT_ACCESS_TTL ?? "15m" },
    }),
    PrismaModule,
    AuditModule,
    IdentityModule,
    PlatformModule,
    OrgModule,
    LedgerModule,
    OperationsModule,
    HrModule,
    RealtimeModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useFactory: (jwt: JwtService, reflector: Reflector) => new AuthGuard(reflector, jwt),
      inject: [JwtService, Reflector],
    },
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector) => new PermissionsGuard(reflector),
      inject: [Reflector],
    },
    {
      provide: APP_INTERCEPTOR,
      useFactory: (prisma: PrismaService) => new RlsInterceptor(prisma),
      inject: [PrismaService],
    },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
