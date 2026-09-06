import { roundMoney } from "./journal";

export const DEFAULT_EXPENSE_BUDGETS = [
  { accountCode: "5101", name: "Beban Operasional", percent: 25 },
  { accountCode: "5102", name: "Beban Personalia", percent: 30 },
  { accountCode: "5103", name: "Beban Cadangan Risiko", percent: 10 },
] as const;

export const DEFAULT_CKPN_RATES = [
  { grade: 1, percent: 0.5 },
  { grade: 2, percent: 3 },
  { grade: 3, percent: 10 },
  { grade: 4, percent: 50 },
  { grade: 5, percent: 100 },
] as const;

export const DEFAULT_SHU_SHARES = [
  { accountCode: "3202", name: "Cadangan dari SHU", percent: 25, sortOrder: 1 },
  { accountCode: "2103", name: "Utang Jasa Anggota", percent: 40, sortOrder: 2 },
  { accountCode: "2104", name: "Dana Pengurus", percent: 10, sortOrder: 3 },
  { accountCode: "2105", name: "Dana Karyawan", percent: 10, sortOrder: 4 },
  { accountCode: "2106", name: "Dana Pendidikan", percent: 10, sortOrder: 5 },
  { accountCode: "2107", name: "Dana Sosial", percent: 5, sortOrder: 6 },
] as const;

export function budgetCap(income: number, percent: number) {
  return roundMoney(Math.max(0, income) * Math.max(0, percent) / 100);
}

export function assessBudget(input: { income: number; percent: number; spent: number; adding: number }) {
  const cap = budgetCap(input.income, input.percent);
  const next = roundMoney(Math.max(0, input.spent) + input.adding);
  return { cap, next, remaining: roundMoney(cap - input.spent), ok: next <= cap + 0.009 };
}

export function requiredCkpn(
  loans: Array<{ outstanding: number; collectability: number }>,
  rates: Array<{ grade: number; percent: number }>,
) {
  const rateOf = (grade: number) => rates.find((r) => r.grade === grade)?.percent ?? 0;
  const byGrade = [1, 2, 3, 4, 5].map((grade) => {
    const outstanding = roundMoney(
      loans.filter((l) => l.collectability === grade).reduce((sum, l) => sum + Math.max(0, l.outstanding), 0),
    );
    return { grade, outstanding, required: roundMoney(outstanding * rateOf(grade) / 100) };
  });
  return { byGrade, required: roundMoney(byGrade.reduce((sum, row) => sum + row.required, 0)) };
}

export function allocateShu(amount: number, shares: Array<{ accountCode: string; percent: number }>) {
  const totalPct = shares.reduce((sum, s) => sum + s.percent, 0);
  if (Math.abs(totalPct - 100) > 0.05) {
    throw Object.assign(new Error("Porsi alokasi SHU harus berjumlah 100%"), { code: "SHU_SHARE_INVALID" });
  }
  const safe = roundMoney(Math.max(0, amount));
  const parts = shares.map((share, i) => {
    if (i === shares.length - 1) return { accountCode: share.accountCode, amount: 0, percent: share.percent };
    return { accountCode: share.accountCode, amount: roundMoney(safe * share.percent / 100), percent: share.percent };
  });
  const used = roundMoney(parts.slice(0, -1).reduce((sum, p) => sum + p.amount, 0));
  if (parts.length) parts[parts.length - 1].amount = roundMoney(safe - used);
  return parts;
}
