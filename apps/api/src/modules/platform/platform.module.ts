import { Module } from "@nestjs/common";
import { IdentityModule } from "../identity/identity.module";
import { OperationsModule } from "../ops/operations.module";
import { PlatformController } from "./platform.controller";
import { TenantsService } from "./tenants.service";

@Module({
  imports: [IdentityModule, OperationsModule],
  controllers: [PlatformController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class PlatformModule {}
