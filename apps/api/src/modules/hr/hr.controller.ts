import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import type { AuthUser } from "@mankopi/shared";
import { CurrentUser, RequirePermissions } from "../../common/decorators";
import { scopeTenant } from "../ops/tenant-scope";
import { HrService } from "./hr.service";

@Controller()
export class HrController {
  constructor(private readonly hr: HrService) {}

  @Get("employees")
  @RequirePermissions("hr:employee:manage")
  employees(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string) {
    return this.hr.listEmployees(scopeTenant(user, tenantId));
  }

  @Post("employees")
  @RequirePermissions("hr:employee:manage")
  createEmployee(
    @CurrentUser() user: AuthUser,
    @Query("tenantId") tenantId: string | undefined,
    @Body()
    body: {
      name: string;
      nik?: string;
      phone?: string;
      position?: string;
      baseSalary: number;
      allowance?: number;
      branchId?: string;
      unitId?: string | null;
      joinedOn?: string;
      tenantId?: string;
    },
  ) {
    return this.hr.createEmployee(scopeTenant(user, tenantId ?? body.tenantId), body, user.id);
  }

  @Patch("employees/:id")
  @RequirePermissions("hr:employee:manage")
  updateEmployee(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query("tenantId") tenantId: string | undefined,
    @Body()
    body: {
      name?: string;
      nik?: string | null;
      phone?: string | null;
      position?: string | null;
      baseSalary?: number;
      allowance?: number;
      branchId?: string;
      unitId?: string | null;
      status?: "ACTIVE" | "DISABLED";
      joinedOn?: string | null;
    },
  ) {
    return this.hr.updateEmployee(scopeTenant(user, tenantId), id, body, user.id);
  }

  @Get("payroll")
  @RequirePermissions("hr:payroll:view")
  payrolls(@CurrentUser() user: AuthUser, @Query("tenantId") tenantId?: string) {
    return this.hr.listPayrolls(scopeTenant(user, tenantId));
  }

  @Get("payroll/:id")
  @RequirePermissions("hr:payroll:view")
  payroll(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query("tenantId") tenantId?: string) {
    return this.hr.getPayroll(scopeTenant(user, tenantId), id);
  }

  @Post("payroll")
  @RequirePermissions("hr:payroll:post")
  createPayroll(
    @CurrentUser() user: AuthUser,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: { year: number; month: number; paidOn?: string; cashAccountCode?: string; memo?: string; tenantId?: string },
  ) {
    return this.hr.createPayroll(scopeTenant(user, tenantId ?? body.tenantId), body, user.id);
  }

  @Patch("payroll/:id/items/:itemId")
  @RequirePermissions("hr:payroll:post")
  updateItem(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Query("tenantId") tenantId: string | undefined,
    @Body() body: { baseSalary?: number; allowance?: number; deduction?: number },
  ) {
    return this.hr.updatePayrollItem(scopeTenant(user, tenantId), id, itemId, body, user.id);
  }

  @Post("payroll/:id/submit")
  @RequirePermissions("hr:payroll:post")
  submit(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query("tenantId") tenantId?: string) {
    return this.hr.submitPayroll(scopeTenant(user, tenantId), id, user.id);
  }

  @Post("payroll/:id/void")
  @RequirePermissions("hr:payroll:post")
  voidRun(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query("tenantId") tenantId?: string) {
    return this.hr.voidPayroll(scopeTenant(user, tenantId), id, user.id);
  }
}
