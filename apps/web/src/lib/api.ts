import type { AuthUser } from "@mankopi/shared";

const TOKEN_KEY = "mankopi.access";
const REFRESH_KEY = "mankopi.refresh";

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setAccessToken(access: string) {
  localStorage.setItem(TOKEN_KEY, access);
}

export function setTokens(access: string, refresh: string) {
  setAccessToken(access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch {
    throw new Error("API tidak dapat dijangkau. Jalankan Docker + pnpm --filter @mankopi/api start.");
  }
  if (res.status === 401 && !path.includes("/auth/login")) {
    clearTokens();
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body?.error?.message as string | undefined;
    if (res.status >= 500 && !message) {
      throw new Error("API sedang mati atau database belum siap. Nyalakan Docker Desktop, lalu start API.");
    }
    throw new Error(message ?? `Request failed ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: AuthUser; accessToken: string; refreshToken: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<AuthUser>("/api/auth/me"),
  reissue: () =>
    request<{ user: AuthUser; accessToken: string }>("/api/auth/reissue", { method: "POST" }),
  tenants: () => request<TenantRow[]>("/api/platform/tenants"),
  createTenant: (body: { slug: string; name: string; legalName?: string }) =>
    request("/api/platform/tenants", { method: "POST", body: JSON.stringify(body) }),
  updateTenant: (id: string, body: { name?: string; legalName?: string; status?: string; plan?: string }) =>
    request(`/api/platform/tenants/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  summary: (tenantId?: string) =>
    request<SummaryRow>(`/api/platform/summary${tenantId ? `?tenantId=${tenantId}` : ""}`),
  users: (tenantId?: string) =>
    request<UserRow[]>(`/api/identity/users${tenantId ? `?tenantId=${tenantId}` : ""}`),
  createUser: (body: Record<string, unknown>) =>
    request("/api/identity/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: string, body: { name?: string; phone?: string | null }) =>
    request(`/api/identity/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  setUserStatus: (id: string, status: "ACTIVE" | "DISABLED") =>
    request(`/api/identity/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  resetPassword: (id: string, password: string) =>
    request(`/api/identity/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }),
  setMembership: (id: string, body: { roleId: string; scope: string; branchId?: string }) =>
    request(`/api/identity/users/${id}/membership`, { method: "PUT", body: JSON.stringify(body) }),
  roles: (tenantId?: string) =>
    request<RoleRow[]>(`/api/identity/roles${tenantId ? `?tenantId=${tenantId}` : ""}`),
  setRolePermissions: (id: string, keys: string[]) =>
    request(`/api/identity/roles/${id}/permissions`, { method: "PUT", body: JSON.stringify({ keys }) }),
  resetRolePermissions: (id: string) =>
    request<RoleRow>(`/api/identity/roles/${id}/reset`, { method: "POST" }),
  branches: (tenantId?: string) =>
    request<BranchRow[]>(`/api/org/branches${tenantId ? `?tenantId=${tenantId}` : ""}`),
  createBranch: (body: { code: string; name: string; address?: string; tenantId?: string }) =>
    request("/api/org/branches", { method: "POST", body: JSON.stringify(body) }),
  updateBranch: (id: string, body: { name?: string; address?: string; status?: string }) =>
    request(`/api/org/branches/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  createUnit: (body: { branchId: string; code: string; name: string }) =>
    request("/api/org/units", { method: "POST", body: JSON.stringify(body) }),
  updateUnit: (id: string, body: { name?: string; status?: string }) =>
    request(`/api/org/units/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  audit: (tenantId?: string) => request<AuditRow[]>(`/api/audit${tenantId ? `?tenantId=${tenantId}` : ""}`),
  health: () => request<{ status: string; timestamp: string }>("/api/health"),
  accounts: (tenantId?: string) =>
    request<AccountRow[]>(`/api/ledger/accounts${q(tenantId)}`),
  createAccount: (body: Record<string, unknown>, tenantId?: string) =>
    request(`/api/ledger/accounts${q(tenantId)}`, { method: "POST", body: JSON.stringify(body) }),
  updateAccount: (id: string, body: Record<string, unknown>, tenantId?: string) =>
    request(`/api/ledger/accounts/${id}${q(tenantId)}`, { method: "PATCH", body: JSON.stringify(body) }),
  ojkMaps: () => request<Array<{ key: string; label: string }>>("/api/ledger/ojk-maps"),
  periods: (tenantId?: string) => request<PeriodRow[]>(`/api/ledger/periods${q(tenantId)}`),
  openPeriod: (body: { year: number; month: number }, tenantId?: string) =>
    request(`/api/ledger/periods${q(tenantId)}`, { method: "POST", body: JSON.stringify(body) }),
  closePeriod: (id: string, tenantId?: string) =>
    request(`/api/ledger/periods/${id}/close${q(tenantId)}`, { method: "POST", body: JSON.stringify({}) }),
  journals: (tenantId?: string) => request<JournalRow[]>(`/api/ledger/journals${q(tenantId)}`),
  postJournal: (body: Record<string, unknown>, tenantId?: string) =>
    request(`/api/ledger/journals${q(tenantId)}`, { method: "POST", body: JSON.stringify(body) }),
  reverseJournal: (id: string, tenantId?: string) =>
    request(`/api/ledger/journals/${id}/reverse${q(tenantId)}`, { method: "POST", body: JSON.stringify({}) }),
  reports: (tenantId?: string, year?: number, month?: number) => {
    const params = new URLSearchParams();
    if (tenantId) params.set("tenantId", tenantId);
    if (year) params.set("year", String(year));
    if (month) params.set("month", String(month));
    const qs = params.toString();
    return request<ReportRow>(`/api/ledger/reports${qs ? `?${qs}` : ""}`);
  },
  budget: (tenantId?: string, year?: number) =>
    request<BudgetOverview>(`/api/ledger/budget${qYear(tenantId, year)}`),
  saveBudget: (body: { rows: Array<{ accountCode: string; name?: string; percent: number; enabled?: boolean }> }, tenantId?: string) =>
    request<BudgetOverview>(`/api/ledger/budget${q(tenantId)}`, { method: "PUT", body: JSON.stringify(body) }),
  ckpn: (tenantId?: string) => request<CkpnOverview>(`/api/ledger/ckpn${q(tenantId)}`),
  saveCkpnRates: (body: { rows: Array<{ grade: number; percent: number }> }, tenantId?: string) =>
    request<CkpnOverview>(`/api/ledger/ckpn/rates${q(tenantId)}`, { method: "PUT", body: JSON.stringify(body) }),
  postCkpn: (body: { postedOn?: string }, tenantId?: string) =>
    request(`/api/ledger/ckpn${q(tenantId)}`, { method: "POST", body: JSON.stringify(body) }),
  shu: (tenantId?: string, year?: number) => request<ShuOverview>(`/api/ledger/shu${qYear(tenantId, year)}`),
  saveShuShares: (body: { rows: Array<{ accountCode: string; name?: string; percent: number; sortOrder?: number }> }, tenantId?: string) =>
    request<ShuOverview["shares"]>(`/api/ledger/shu/shares${q(tenantId)}`, { method: "PUT", body: JSON.stringify(body) }),
  closeYear: (year: number, tenantId?: string) =>
    request<ShuOverview>(`/api/ledger/shu/close${q(tenantId)}`, { method: "POST", body: JSON.stringify({ year }) }),
  allocateYear: (year: number, tenantId?: string) =>
    request<ShuOverview>(`/api/ledger/shu/allocate${q(tenantId)}`, { method: "POST", body: JSON.stringify({ year }) }),
  voidYearClose: (year: number, tenantId?: string) =>
    request<ShuOverview>(`/api/ledger/shu/void${q(tenantId)}`, { method: "POST", body: JSON.stringify({ year }) }),
};

function q(tenantId?: string) {
  return tenantId ? `?tenantId=${tenantId}` : "";
}

function qYear(tenantId?: string, year?: number) {
  const params = new URLSearchParams();
  if (tenantId) params.set("tenantId", tenantId);
  if (year) params.set("year", String(year));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const ops = {
  members: (tenantId?: string) => request<MemberRow[]>(`/api/members${q(tenantId)}`),
  createMember: (body: Record<string, unknown>, tenantId?: string) =>
    request(`/api/members${q(tenantId)}`, { method: "POST", body: JSON.stringify(body) }),
  updateMember: (id: string, body: Record<string, unknown>, tenantId?: string) =>
    request(`/api/members/${id}${q(tenantId)}`, { method: "PATCH", body: JSON.stringify(body) }),
  savingProducts: (tenantId?: string) => request<SavingProductRow[]>(`/api/savings/products${q(tenantId)}`),
  createSavingProduct: (body: Record<string, unknown>, tenantId?: string) =>
    request(`/api/savings/products${q(tenantId)}`, { method: "POST", body: JSON.stringify(body) }),
  updateSavingProduct: (id: string, body: Record<string, unknown>, tenantId?: string) =>
    request(`/api/savings/products/${id}${q(tenantId)}`, { method: "PATCH", body: JSON.stringify(body) }),
  setup: (tenantId?: string) => request<SetupRow>(`/api/setup${q(tenantId)}`),
  savePolicy: (body: { requirePokokForLoan?: boolean; requireWajibForLoan?: boolean }, tenantId?: string) =>
    request<TenantPolicy>(`/api/setup/policy${q(tenantId)}`, { method: "PATCH", body: JSON.stringify(body) }),
  provisionProducts: (tenantId?: string) =>
    request(`/api/setup/provision${q(tenantId)}`, { method: "POST", body: JSON.stringify({}) }),
  postOpeningCapital: (body: { amount: number; cashCode?: string; postedOn?: string; memo?: string }, tenantId?: string) =>
    request(`/api/setup/opening-capital${q(tenantId)}`, { method: "POST", body: JSON.stringify(body) }),
  mutateSaving: (body: { accountId: string; type: "SETOR" | "TARIK"; amount: number }, tenantId?: string) =>
    request(`/api/savings/mutate${q(tenantId)}`, { method: "POST", body: JSON.stringify(body) }),
  savingAccounts: (tenantId?: string) => request<SavingAccountRow[]>(`/api/savings/accounts${q(tenantId)}`),
  savingAccount: (id: string, tenantId?: string) => request<SavingAccountLedger>(`/api/savings/accounts/${id}${q(tenantId)}`),
  loans: (tenantId?: string) => request<LoanRow[]>(`/api/loans${q(tenantId)}`),
  loanReview: (id: string, tenantId?: string) => request<LoanReview>(`/api/loans/${id}/review${q(tenantId)}`),
  loanProducts: (tenantId?: string) => request<LoanProductRow[]>(`/api/loans/products${q(tenantId)}`),
  createLoanProduct: (body: Record<string, unknown>, tenantId?: string) =>
    request(`/api/loans/products${q(tenantId)}`, { method: "POST", body: JSON.stringify(body) }),
  updateLoanProduct: (id: string, body: Record<string, unknown>, tenantId?: string) =>
    request(`/api/loans/products/${id}${q(tenantId)}`, { method: "PATCH", body: JSON.stringify(body) }),
  createLoan: (body: { memberId: string; productId: string; principal: number }, tenantId?: string) =>
    request(`/api/loans${q(tenantId)}`, { method: "POST", body: JSON.stringify(body) }),
  decideLoan: (
    id: string,
    body: { decision: "APPROVED" | "CONDITIONAL" | "REJECTED"; note: string; conditions?: string },
    tenantId?: string,
  ) => request(`/api/loans/${id}/decide${q(tenantId)}`, { method: "POST", body: JSON.stringify(body) }),
  disburse: (id: string, tenantId?: string, body?: { conditionsCleared?: boolean }) =>
    request(`/api/loans/${id}/disburse${q(tenantId)}`, { method: "POST", body: JSON.stringify(body ?? {}) }),
  holidays: (tenantId?: string) => request<HolidayRow[]>(`/api/calendar${q(tenantId)}`),
  addHoliday: (body: { date: string; name: string }, tenantId?: string) =>
    request(`/api/calendar${q(tenantId)}`, { method: "POST", body: JSON.stringify(body) }),
  todayCards: (tenantId?: string, scope: "due" | "early" = "due") => {
    const params = new URLSearchParams();
    if (tenantId) params.set("tenantId", tenantId);
    if (scope === "early") params.set("scope", "early");
    const qs = params.toString();
    return request<CollectCard[]>(`/api/collection/today${qs ? `?${qs}` : ""}`);
  },
  receipts: (tenantId?: string) => request<ReceiptRow[]>(`/api/collection/receipts${q(tenantId)}`),
  collect: (body: { loanId: string; amount: number; clientReceiptId: string }, tenantId?: string) =>
    request(`/api/collection/receipts${q(tenantId)}`, { method: "POST", body: JSON.stringify(body) }),
  voidReceipt: (id: string, tenantId?: string) =>
    request(`/api/collection/receipts/${id}/void${q(tenantId)}`, { method: "POST", body: JSON.stringify({}) }),
  analytics: (tenantId?: string) => request<AnalyticsRow>(`/api/analytics${q(tenantId)}`),
  employees: (tenantId?: string) => request<EmployeeRow[]>(`/api/employees${q(tenantId)}`),
  createEmployee: (body: Record<string, unknown>, tenantId?: string) =>
    request(`/api/employees${q(tenantId)}`, { method: "POST", body: JSON.stringify(body) }),
  updateEmployee: (id: string, body: Record<string, unknown>, tenantId?: string) =>
    request(`/api/employees/${id}${q(tenantId)}`, { method: "PATCH", body: JSON.stringify(body) }),
  payrolls: (tenantId?: string) => request<PayrollRunRow[]>(`/api/payroll${q(tenantId)}`),
  payroll: (id: string, tenantId?: string) => request<PayrollRunRow>(`/api/payroll/${id}${q(tenantId)}`),
  createPayroll: (body: Record<string, unknown>, tenantId?: string) =>
    request(`/api/payroll${q(tenantId)}`, { method: "POST", body: JSON.stringify(body) }),
  updatePayrollItem: (runId: string, itemId: string, body: Record<string, unknown>, tenantId?: string) =>
    request(`/api/payroll/${runId}/items/${itemId}${q(tenantId)}`, { method: "PATCH", body: JSON.stringify(body) }),
  submitPayroll: (id: string, tenantId?: string) =>
    request(`/api/payroll/${id}/submit${q(tenantId)}`, { method: "POST", body: JSON.stringify({}) }),
  voidPayroll: (id: string, tenantId?: string) =>
    request(`/api/payroll/${id}/void${q(tenantId)}`, { method: "POST", body: JSON.stringify({}) }),
};

export type EmployeeRow = {
  id: string;
  employeeNo: string;
  name: string;
  nik?: string | null;
  phone?: string | null;
  position?: string | null;
  baseSalary: string | number;
  allowance: string | number;
  status: string;
  joinedOn?: string | null;
  branchId?: string | null;
  unitId?: string | null;
  branch?: { id: string; code: string; name: string } | null;
  unit?: { id: string; code: string; name: string; branchId: string } | null;
};

export type PayrollItemRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  position?: string | null;
  baseSalary: string | number;
  allowance: string | number;
  deduction: string | number;
  net: string | number;
  employee?: { id: string; employeeNo: string };
};

export type PayrollRunRow = {
  id: string;
  year: number;
  month: number;
  status: string;
  paidOn: string;
  cashAccountCode: string;
  memo?: string | null;
  journalId?: string | null;
  items: PayrollItemRow[];
};

export type MemberRow = {
  id: string;
  memberNo: string;
  nik: string;
  name: string;
  gender?: string | null;
  religion?: string | null;
  maritalStatus?: string | null;
  education?: string | null;
  phone?: string | null;
  phoneAlt?: string | null;
  email?: string | null;
  address?: string | null;
  rtRw?: string | null;
  village?: string | null;
  district?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  placeOfBirth?: string | null;
  dateOfBirth?: string | null;
  motherName?: string | null;
  npwp?: string | null;
  familyCardNo?: string | null;
  spouseName?: string | null;
  spouseNik?: string | null;
  dependents?: number | null;
  heirName?: string | null;
  heirRelation?: string | null;
  heirPhone?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  emergencyRelation?: string | null;
  occupation?: string | null;
  employmentType?: string | null;
  employerName?: string | null;
  workAddress?: string | null;
  monthlyIncome?: string | number | null;
  otherIncome?: string | number | null;
  houseStatus?: string | null;
  yearsAtAddress?: number | null;
  joinedOn?: string | null;
  memberType?: string | null;
  notes?: string | null;
  status: string;
  slikConsentAt?: string | null;
  branchId?: string | null;
  unitId?: string | null;
  branch?: { id: string; code: string; name: string } | null;
  unit?: { id: string; code: string; name: string; branchId: string } | null;
  savingAccounts: Array<{ id: string; accountNo: string; balance: string | number; product: SavingProductRow }>;
  loans: Array<{ id: string; loanNo: string; status: string }>;
};

export type TenantPolicy = {
  requirePokokForLoan: boolean;
  requireWajibForLoan: boolean;
};

export type SetupRow = {
  policy: TenantPolicy;
  cashAccounts: Array<{ code: string; name: string }>;
  ready: {
    accounts: number;
    openPeriod: boolean;
    openingCapital: number;
    savingProducts: number;
    withdrawableProducts: number;
    loanProducts: number;
    holidays: number;
  };
};

export type SavingProductRow = {
  id: string;
  code: string;
  name: string;
  kind: string;
  accountCode: string;
  minAmount: string | number;
  withdrawable: boolean;
  openOnJoin: boolean;
  status: string;
  hasMovements?: boolean;
  _count?: { accounts: number };
};

export type SavingAccountRow = {
  id: string;
  accountNo: string;
  balance: string | number;
  status: string;
  createdAt: string;
  member: { id: string; memberNo: string; name: string };
  product: SavingProductRow;
  _count: { txns: number };
};

export type SavingLedgerRow = {
  id: string;
  type: "SETOR" | "TARIK" | string;
  amount: number;
  occurredOn: string;
  createdAt: string;
  journalId: string | null;
  journalNo: string | null;
  memo: string | null;
  balanceAfter: number;
};

export type SavingAccountLedger = {
  id: string;
  accountNo: string;
  balance: number;
  status: string;
  openedOn: string;
  member: { id: string; memberNo: string; name: string };
  product: SavingProductRow;
  summary: { txnCount: number; totalSetor: number; totalTarik: number };
  ledger: SavingLedgerRow[];
};
export type LoanProductRow = {
  id: string;
  code: string;
  name: string;
  method: string;
  frequency: string;
  rateBasis?: string;
  annualRate: string | number;
  periods: number;
  graceDays?: number;
  penaltyKind?: string;
  penaltyValue?: string | number;
  minPrincipal?: string | number;
  maxPrincipal?: string | number | null;
  status: string;
  hasLiveLoans?: boolean;
  _count?: { loans: number };
};
export type LoanDecisionKind = "APPROVED" | "CONDITIONAL" | "REJECTED";
export type LoanRow = {
  id: string;
  loanNo: string;
  principal: string | number;
  outstandingPrincipal: string | number;
  status: string;
  collectability: number;
  decisionKind?: string | null;
  decisionNote?: string | null;
  decisionConditions?: string | null;
  decidedAt?: string | null;
  decidedBy?: { id: string; name: string; email: string } | null;
  conditionsClearedAt?: string | null;
  member: { id: string; name: string; memberNo: string };
  product: LoanProductRow;
  schedule: Array<{ id: string; sequence: number; dueDate: string; principalDue: string | number; interestDue: string | number; status: string }>;
};
export type LoanReview = {
  loan: LoanRow & {
    annualRate: number;
    rateBasis: string;
    method: string;
    frequency: string;
    periods: number;
    createdAt: string;
  };
  member: {
    id: string;
    memberNo: string;
    name: string;
    nik: string;
    gender?: string | null;
    religion?: string | null;
    maritalStatus?: string | null;
    education?: string | null;
    phone?: string | null;
    phoneAlt?: string | null;
    email?: string | null;
    address?: string | null;
    placeOfBirth?: string | null;
    dateOfBirth?: string | null;
    ageYears?: number | null;
    motherName?: string | null;
    npwp?: string | null;
    familyCardNo?: string | null;
    spouseName?: string | null;
    dependents?: number | null;
    heirName?: string | null;
    heirRelation?: string | null;
    heirPhone?: string | null;
    emergencyName?: string | null;
    emergencyPhone?: string | null;
    emergencyRelation?: string | null;
    occupation?: string | null;
    employmentType?: string | null;
    employerName?: string | null;
    workAddress?: string | null;
    monthlyIncome?: number | null;
    otherIncome?: number | null;
    houseStatus?: string | null;
    yearsAtAddress?: number | null;
    memberType?: string | null;
    status: string;
    slikConsentAt?: string | null;
    branch?: { id: string; code: string; name: string } | null;
    unit?: { id: string; code: string; name: string } | null;
  };
  savings: Array<{ id: string; accountNo?: string; kind: string; name: string; balance: number; minAmount: number }>;
  savingsTotal: number;
  history: {
    loanCount: number;
    disbursedTotal: number;
    activeCount: number;
    activeOutstanding: number;
    lancarCount: number;
    lancarOutstanding: number;
    macetCount: number;
    macetOutstanding: number;
    loans: Array<{
      id: string;
      loanNo: string;
      productName: string;
      principal: number;
      outstanding: number;
      status: string;
      collectability: number;
      createdAt: string;
    }>;
  };
  policy: TenantPolicy;
  flags: Array<{ level: "ok" | "warn"; code: string; label: string }>;
  preview: {
    installment: number;
    totalInterest: number;
    firstDue: string | null;
    lastDue: string | null;
    schedule: Array<{ sequence: number; dueDate: string; principalDue: number; interestDue: number; totalDue: number }>;
  };
};
export type HolidayRow = { id: string; date: string; name: string; source: string; enabled: boolean };
export type CollectCard = {
  id: string;
  dueDate: string;
  remaining: number;
  penalty?: number;
  daysOverdue: number;
  graceDays?: number;
  inGrace?: boolean;
  upcoming?: boolean;
  collectability: number;
  loan: { id: string; loanNo: string; member: { name: string; phone?: string | null } };
};
export type ReceiptRow = {
  id: string;
  receiptNo: string;
  amount: string | number;
  paidOn: string;
  status?: string;
  member: { name: string };
  loan: { loanNo: string };
};
export type AnalyticsRow = {
  members: number;
  savings: number;
  outstanding: number;
  nplCount: number;
  nplAmount: number;
  nplRatio: number;
  shu: number;
  aging: Record<string, number>;
  ojk: Array<{ key: string; label: string; net: number }>;
  cash?: number;
  cashKas?: number;
  cashBank?: number;
  trial: { balanced: boolean; debit: number; credit: number };
};

export type TenantRow = {
  id: string;
  slug: string;
  name: string;
  legalName?: string | null;
  status: string;
  plan: string;
  _count?: { users: number; branches: number };
};

export type OverviewRow = {
  members: number;
  savings: number;
  outstanding: number;
  nplCount: number;
  nplAmount: number;
  nplRatio: number;
  pendingApproval: number;
  pendingDisburse: number;
  collectionDue: number;
  collectionOverdue: number;
  collectionDueAmount: number;
  collectedToday: number;
  collectedTodayCount: number;
  cash: number;
  cashKas: number;
  cashBank: number;
  units: number;
};

export type SummaryRow = {
  tenants: number;
  users: number;
  branches: number;
  suspended: number;
  tenant?: { id: string; name: string; slug: string; status: string; plan: string; legalName?: string | null } | null;
  recentAudit: Array<{ id: string; action: string; createdAt: string; actor?: { name: string } | null }>;
  ops?: OverviewRow | null;
};

export type UserRow = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  status: string;
  tenantId: string | null;
  lastLoginAt: string | null;
  tenant?: { id: string; name: string; slug: string } | null;
  memberships: Array<{ role: { id: string; name: string }; branch?: { id: string; name: string } | null }>;
};

export type RoleRow = {
  id: string;
  name: string;
  slug: string;
  layer: string;
  tenantId: string | null;
  isSystem: boolean;
  permissions: Array<{ permission: { key: string } }>;
};

export type BranchStats = {
  members: number;
  disbursedTotal: number;
  activeCount: number;
  activeOutstanding: number;
  lancarCount: number;
  lancarOutstanding: number;
  macetCount: number;
  macetOutstanding: number;
};

export type BranchRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  address?: string | null;
  tenantId: string;
  tenant?: { id: string; name: string; slug: string };
  units: Array<{ id: string; code: string; name: string; status: string }>;
  stats?: BranchStats;
};

export type AuditRow = {
  id: string;
  action: string;
  resource: string;
  createdAt: string;
  actor?: { name: string; email: string } | null;
};

export type AccountRow = {
  id: string;
  code: string;
  name: string;
  classCode: string;
  normalBalance: string;
  isCash: boolean;
  report: string;
  cashFlow?: string | null;
  ojkMap?: string | null;
  status: string;
  isSystem: boolean;
};

export type PeriodRow = {
  id: string;
  year: number;
  month: number;
  startsOn: string;
  endsOn: string;
  status: string;
  _count?: { journals: number };
};

export type JournalRow = {
  id: string;
  number: string;
  postedOn: string;
  memo?: string | null;
  sourceType: string;
  status: string;
  debitTotal: string | number;
  creditTotal: string | number;
  reversesId?: string | null;
  lines: Array<{
    id: string;
    debit: string | number;
    credit: string | number;
    memo?: string | null;
    account: AccountRow;
  }>;
};

export type ReportRow = {
  trial: { debit: number; credit: number; balanced: boolean };
  neraca: Array<{ accountCode: string; name: string; debit: number; credit: number; net: number; classCode: string }>;
  phu: Array<{ accountCode: string; name: string; debit: number; credit: number; net: number; classCode: string }>;
  cashFlow: { OPERATING: number; INVESTING: number; FINANCING: number };
  cashMoves?: Array<{
    journalId: string;
    number: string;
    postedOn: string;
    sourceType: string;
    memo?: string | null;
    kind: "OPERATING" | "INVESTING" | "FINANCING";
    amount: number;
  }>;
  cashPosition: { kas: number; bank: number; other: number; total: number };
  ojk: Array<{ key: string; label: string; net: number }>;
};

export type BudgetOverview = {
  year: number;
  income: number;
  rows: Array<{
    id: string;
    accountCode: string;
    name: string;
    percent: number;
    enabled: boolean;
    spent: number;
    cap: number;
    remaining: number;
  }>;
};

export type CkpnOverview = {
  rates: Array<{ id: string; grade: number; percent: number }>;
  byGrade: Array<{ grade: number; outstanding: number; required: number }>;
  required: number;
  current: number;
  delta: number;
};

export type ShuOverview = {
  year: number;
  income: number;
  expense: number;
  livePhu: number;
  phuNet: number;
  closed: boolean;
  allocated: boolean;
  closeJournalId?: string | null;
  allocateJournalId?: string | null;
  shares: Array<{ id: string; accountCode: string; name: string; percent: number; sortOrder: number }>;
  allocation: Array<{ accountCode: string; amount: number; percent: number }>;
};
