import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import type { AuthUser } from "@mankopi/shared";
import { ERROR_CODES } from "@mankopi/shared";
import { CurrentUser, RequirePermissions } from "../../common/decorators";
import { LedgerService } from "./ledger.service";

function scopeTenant(user: AuthUser, tenantId?: string) {
  const id = user.isPlatformAdmin ? tenantId : user.tenantId ?? undefined;
  if (!id) {
    throw new BadRequestException({
      code: ERROR_CODES.TENANT_REQUIRED,
      message: "Pilih konteks koperasi sebelum membuka buku besar",
    });
  }
  return id;
}

@Controller("ledger")
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get("accounts")
  @RequirePermissions("ledger:view")
  accounts(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string) {
    return this.ledger.listAccounts(scopeTenant(user, tenantId));
  }

  @Get("ojk-maps")
  @RequirePermissions("ledger:view")
  ojkMaps() {
    return this.ledger.ojkMaps();
  }

  @Post("accounts")
  @RequirePermissions("ledger:post_manual")
  createAccount(
    @CurrentUser() user: AuthUser,
    @Query("tenantId") tenantId: string | undefined,
    @Body()
    body: {
      code: string;
      name: string;
      classCode: string;
      normalBalance: "DEBIT" | "CREDIT";
      isCash?: boolean;
      report: "NERACA" | "PHU" | "ARUS_KAS";
      cashFlow?: string;
      ojkMap?: string;
      tenantId?: string;
    },
  ) {
    return this.ledger.createAccount(scopeTenant(user, tenantId ?? body.tenantId), body, user.id);
  }

  @Patch("accounts/:id")
  @RequirePermissions("ledger:post_manual")
  updateAccount(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: { name?: string; ojkMap?: string | null; status?: string; isCash?: boolean; cashFlow?: string | null },
  ) {
    return this.ledger.updateAccount(scopeTenant(user, tenantId), id, body, user.id);
  }

  @Get("periods")
  @RequirePermissions("ledger:view")
  periods(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string) {
    return this.ledger.listPeriods(scopeTenant(user, tenantId));
  }

  @Post("periods")
  @RequirePermissions("ledger:post_manual")
  openPeriod(
    @CurrentUser() user: AuthUser,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: { year: number; month: number; tenantId?: string },
  ) {
    return this.ledger.openPeriod(scopeTenant(user, tenantId ?? body.tenantId), body.year, body.month, user.id);
  }

  @Post("periods/:id/close")
  @RequirePermissions("ledger:post_manual")
  closePeriod(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query("tenantId") tenantId?: string) {
    return this.ledger.closePeriod(scopeTenant(user, tenantId), id, user.id);
  }

  @Get("journals")
  @RequirePermissions("ledger:view")
  journals(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string) {
    return this.ledger.listJournals(scopeTenant(user, tenantId));
  }

  @Post("journals")
  @RequirePermissions("ledger:post_manual")
  post(
    @CurrentUser() user: AuthUser,
    @Query("tenantId") tenantId: string | undefined,
    @Body()
    body: {
      postedOn: string;
      memo?: string;
      tenantId?: string;
      lines: Array<{ accountId: string; debit: number; credit: number; memo?: string }>;
    },
  ) {
    return this.ledger.postManual(scopeTenant(user, tenantId ?? body.tenantId), body, user.id);
  }

  @Post("journals/:id/reverse")
  @RequirePermissions("ledger:post_manual")
  reverse(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query("tenantId") tenantId?: string) {
    return this.ledger.reverse(scopeTenant(user, tenantId), id, user.id);
  }

  @Get("reports")
  @RequirePermissions("ledger:view")
  reports(
    @CurrentUser() user: AuthUser,
    @Query("tenantId") tenantId?: string,
    @Query("year") year?: string,
    @Query("month") month?: string,
  ) {
    return this.ledger.reports(scopeTenant(user, tenantId), year ? Number(year) : undefined, month ? Number(month) : undefined);
  }

  @Get("budget")
  @RequirePermissions("ledger:view")
  budget(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string, @Query("year") year?: string) {
    return this.ledger.budgetOverview(scopeTenant(user, tenantId), year ? Number(year) : new Date().getUTCFullYear());
  }

  @Put("budget")
  @RequirePermissions("ledger:post_manual")
  saveBudget(
    @CurrentUser() user: AuthUser,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: { year?: number; rows: Array<{ accountCode: string; name?: string; percent: number; enabled?: boolean }>; tenantId?: string },
  ) {
    return this.ledger.saveBudgets(scopeTenant(user, tenantId ?? body.tenantId), body.rows, user.id);
  }

  @Get("ckpn")
  @RequirePermissions("ledger:view")
  ckpn(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string) {
    return this.ledger.ckpnOverview(scopeTenant(user, tenantId));
  }

  @Put("ckpn/rates")
  @RequirePermissions("ledger:post_manual")
  saveCkpnRates(
    @CurrentUser() user: AuthUser,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: { rows: Array<{ grade: number; percent: number }>; tenantId?: string },
  ) {
    return this.ledger.saveCkpnRates(scopeTenant(user, tenantId ?? body.tenantId), body.rows, user.id);
  }

  @Post("ckpn")
  @RequirePermissions("ledger:post_manual")
  postCkpn(
    @CurrentUser() user: AuthUser,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: { postedOn?: string; tenantId?: string },
  ) {
    const postedOn = body.postedOn ?? new Date().toISOString().slice(0, 10);
    return this.ledger.postCkpn(scopeTenant(user, tenantId ?? body.tenantId), postedOn, user.id);
  }

  @Get("shu")
  @RequirePermissions("ledger:view")
  shu(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string, @Query("year") year?: string) {
    return this.ledger.yearClosePreview(scopeTenant(user, tenantId), year ? Number(year) : new Date().getUTCFullYear());
  }

  @Put("shu/shares")
  @RequirePermissions("ledger:close")
  saveShuShares(
    @CurrentUser() user: AuthUser,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: { rows: Array<{ accountCode: string; name?: string; percent: number; sortOrder?: number }>; tenantId?: string },
  ) {
    return this.ledger.saveShuShares(scopeTenant(user, tenantId ?? body.tenantId), body.rows, user.id);
  }

  @Post("shu/close")
  @RequirePermissions("ledger:close")
  closeYear(
    @CurrentUser() user: AuthUser,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: { year: number; tenantId?: string },
  ) {
    return this.ledger.closeYear(scopeTenant(user, tenantId ?? body.tenantId), body.year, user.id);
  }

  @Post("shu/allocate")
  @RequirePermissions("ledger:close")
  allocateYear(
    @CurrentUser() user: AuthUser,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: { year: number; tenantId?: string },
  ) {
    return this.ledger.allocateYear(scopeTenant(user, tenantId ?? body.tenantId), body.year, user.id);
  }

  @Post("shu/void")
  @RequirePermissions("ledger:close")
  voidYear(
    @CurrentUser() user: AuthUser,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: { year: number; tenantId?: string },
  ) {
    return this.ledger.voidYearClose(scopeTenant(user, tenantId ?? body.tenantId), body.year, user.id);
  }
}
