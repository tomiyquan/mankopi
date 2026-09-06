import { Controller, Get } from "@nestjs/common";
import type { HealthStatus } from "@mankopi/shared";
import { Public } from "../../common/decorators";
import { PrismaService } from "../../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check(): Promise<HealthStatus> {
    try {
      await this.prisma.db.$queryRaw`SELECT 1`;
      return { status: "ok", service: "api", timestamp: new Date().toISOString() };
    } catch {
      return { status: "degraded", service: "api", timestamp: new Date().toISOString() };
    }
  }
}
