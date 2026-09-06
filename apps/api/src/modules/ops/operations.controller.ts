import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import type { AuthUser } from "@mankopi/shared";
import { CurrentUser, RequirePermissions } from "../../common/decorators";
import { OperationsService } from "./operations.service";
import { scopeTenant } from "./tenant-scope";

@Controller()
export class OperationsController {
  constructor(private readonly ops: OperationsService) {}

  @Get("members")
  @RequirePermissions("member:view")
  members(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string) {
    return this.ops.listMembers(scopeTenant(user, tenantId));
  }

  @Post("members")
  @RequirePermissions("member:create")
  createMember(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId: string | undefined, @Body() body: Parameters<OperationsService["createMember"]>[1] & { tenantId?: string }) {
    return this.ops.createMember(scopeTenant(user, tenantId ?? body.tenantId), body, user.id);
  }

  @Patch("members/:id")
  @RequirePermissions("member:create")
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: Parameters<OperationsService["updateMember"]>[2],
  ) {
    return this.ops.updateMember(scopeTenant(user, tenantId), id, body, user.id);
  }

  @Get("savings/products")
  @RequirePermissions("savings:view")
  products(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string) {
    return this.ops.listSavingProducts(scopeTenant(user, tenantId));
  }

  @Post("savings/products")
  @RequirePermissions("savings:post")
  createSavingProduct(
    @CurrentUser() user: AuthUser,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: Parameters<OperationsService["createSavingProduct"]>[1] & { tenantId?: string },
  ) {
    return this.ops.createSavingProduct(scopeTenant(user, tenantId ?? body.tenantId), body, user.id);
  }

  @Patch("savings/products/:id")
  @RequirePermissions("savings:post")
  updateSavingProduct(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: Parameters<OperationsService["updateSavingProduct"]>[2] & { tenantId?: string },
  ) {
    return this.ops.updateSavingProduct(scopeTenant(user, tenantId ?? body.tenantId), id, body, user.id);
  }

  @Get("setup")
  @RequirePermissions("savings:view")
  setup(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string) {
    return this.ops.setupSnapshot(scopeTenant(user, tenantId));
  }

  @Patch("setup/policy")
  @RequirePermissions("savings:post")
  savePolicy(
    @CurrentUser() user: AuthUser,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: { requirePokokForLoan?: boolean; requireWajibForLoan?: boolean; tenantId?: string },
  ) {
    return this.ops.savePolicy(scopeTenant(user, tenantId ?? body.tenantId), body, user.id);
  }

  @Post("setup/provision")
  @RequirePermissions("savings:post")
  provisionSetup(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string, @Body() body?: { tenantId?: string }) {
    const scoped = scopeTenant(user, tenantId ?? body?.tenantId);
    return this.ops.provisionMaster(scoped).then(() => this.ops.setupSnapshot(scoped));
  }

  @Post("setup/opening-capital")
  @RequirePermissions("ledger:post_manual")
  openingCapital(
    @CurrentUser() user: AuthUser,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: { amount: number; cashCode?: string; postedOn?: string; memo?: string; tenantId?: string },
  ) {
    return this.ops.postOpeningCapital(scopeTenant(user, tenantId ?? body.tenantId), body, user.id);
  }

  @Post("products/provision")
  @RequirePermissions("savings:post")
  provisionProducts(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string, @Body() body?: { tenantId?: string }) {
    const scoped = scopeTenant(user, tenantId ?? body?.tenantId);
    return this.ops.provisionMaster(scoped).then(() => ({ ok: true }));
  }

  @Get("savings/accounts")
  @RequirePermissions("savings:view")
  savingAccounts(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string) {
    return this.ops.listSavingAccounts(scopeTenant(user, tenantId));
  }

  @Get("savings/accounts/:id")
  @RequirePermissions("savings:view")
  savingAccount(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query("tenantId") tenantId?: string) {
    return this.ops.getSavingAccount(scopeTenant(user, tenantId), id);
  }

  @Post("savings/mutate")
  @RequirePermissions("savings:post")
  mutate(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId: string | undefined, @Body() body: { accountId: string; type: "SETOR" | "TARIK"; amount: number; occurredOn?: string; tenantId?: string }) {
    return this.ops.mutateSaving(scopeTenant(user, tenantId ?? body.tenantId), body, user.id);
  }

  @Get("loans")
  @RequirePermissions("loan:view")
  loans(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string) {
    return this.ops.listLoans(scopeTenant(user, tenantId));
  }

  @Get("loans/:id/review")
  @RequirePermissions("loan:view")
  loanReview(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query("tenantId") tenantId?: string) {
    return this.ops.getLoanReview(scopeTenant(user, tenantId), id);
  }

  @Get("loans/products")
  @RequirePermissions("loan:view")
  loanProducts(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string) {
    return this.ops.listLoanProducts(scopeTenant(user, tenantId));
  }

  @Post("loans/products")
  @RequirePermissions("loan:approve")
  createLoanProduct(
    @CurrentUser() user: AuthUser,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: Parameters<OperationsService["createLoanProduct"]>[1] & { tenantId?: string },
  ) {
    return this.ops.createLoanProduct(scopeTenant(user, tenantId ?? body.tenantId), body, user.id);
  }

  @Patch("loans/products/:id")
  @RequirePermissions("loan:approve")
  updateLoanProduct(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: Parameters<OperationsService["updateLoanProduct"]>[2] & { tenantId?: string },
  ) {
    return this.ops.updateLoanProduct(scopeTenant(user, tenantId ?? body.tenantId), id, body, user.id);
  }

  @Post("loans")
  @RequirePermissions("loan:create")
  createLoan(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId: string | undefined, @Body() body: { memberId: string; productId: string; principal: number; tenantId?: string }) {
    return this.ops.createLoan(scopeTenant(user, tenantId ?? body.tenantId), body, user.id);
  }

  @Post("loans/:id/decide")
  @RequirePermissions("loan:approve")
  decide(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: { decision: "APPROVED" | "CONDITIONAL" | "REJECTED"; note?: string; conditions?: string },
  ) {
    return this.ops.decideLoan(scopeTenant(user, tenantId), id, body, user.id);
  }

  @Post("loans/:id/disburse")
  @RequirePermissions("loan:approve")
  disburse(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: { conditionsCleared?: boolean },
  ) {
    return this.ops.disburse(scopeTenant(user, tenantId), id, user.id, body);
  }

  @Get("calendar")
  @RequirePermissions("loan:view")
  calendar(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string) {
    return this.ops.listHolidays(scopeTenant(user, tenantId));
  }

  @Post("calendar")
  @RequirePermissions("loan:approve")
  addHoliday(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId: string | undefined, @Body() body: { date: string; name: string; tenantId?: string }) {
    return this.ops.addHoliday(scopeTenant(user, tenantId ?? body.tenantId), body);
  }

  @Get("collection/today")
  @RequirePermissions("collection:view")
  today(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string, @Query("scope") scope?: string) {
    return this.ops.todayCards(scopeTenant(user, tenantId), scope === "early" ? "early" : "due");
  }

  @Get("collection/receipts")
  @RequirePermissions("collection:view")
  receipts(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string) {
    return this.ops.listReceipts(scopeTenant(user, tenantId));
  }

  @Post("collection/receipts/:id/void")
  @RequirePermissions("collection:create")
  voidReceipt(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query("tenantId") tenantId?: string) {
    return this.ops.voidReceipt(scopeTenant(user, tenantId), id, user.id);
  }

  @Post("collection/receipts")
  @RequirePermissions("collection:create")
  collect(
    @CurrentUser() user: AuthUser,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: { loanId: string; amount: number; clientReceiptId: string; paidOn?: string; tenantId?: string },
  ) {
    return this.ops.collect(scopeTenant(user, tenantId ?? body.tenantId), body, user.id);
  }

  @Get("analytics")
  @RequirePermissions("report:phu:view")
  analytics(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string) {
    return this.ops.analytics(scopeTenant(user, tenantId));
  }
}
