import { Module } from "@nestjs/common";
import { LedgerModule } from "../ledger/ledger.module";
import { HrController } from "./hr.controller";
import { HrService } from "./hr.service";

@Module({
  imports: [LedgerModule],
  controllers: [HrController],
  providers: [HrService],
  exports: [HrService],
})
export class HrModule {}
