import { ACCOUNT_CLASSES } from "@mankopi/shared";
import { classOfAccount } from "./coa";
import { roundMoney } from "./journal";

export type AccountBalance = {
  accountCode: string;
  debit: number;
  credit: number;
};

export function netBalance(accountCode: string, debit: number, credit: number): number {
  const cls = classOfAccount(accountCode);
  const debitNormal = cls === ACCOUNT_CLASSES.ASSET || cls === ACCOUNT_CLASSES.EXPENSE;
  return roundMoney(debitNormal ? debit - credit : credit - debit);
}

export function trialBalance(rows: AccountBalance[]) {
  const debit = roundMoney(rows.reduce((s, r) => s + r.debit, 0));
  const credit = roundMoney(rows.reduce((s, r) => s + r.credit, 0));
  return { debit, credit, balanced: debit === credit };
}

export function splitStatements(rows: AccountBalance[]) {
  const neraca = rows.filter((r) => ["1", "2", "3"].includes(classOfAccount(r.accountCode)));
  const phu = rows.filter((r) => ["4", "5"].includes(classOfAccount(r.accountCode)));
  return { neraca, phu };
}

export type CashFlowKind = "OPERATING" | "INVESTING" | "FINANCING";

export type CashFlowAccount = {
  code?: string;
  accountCode?: string;
  classCode: string;
  cashFlow?: string | null;
  ojkMap?: string | null;
};

/** Arus kas KSP: kredit/simpanan operasional = operasi; aset tetap = investasi; modal = pendanaan. */
export function classifyCashFlow(account: CashFlowAccount | string): CashFlowKind {
  if (typeof account === "string") return classifyCashFlow({ classCode: account });
  if (account.cashFlow === "OPERATING" || account.cashFlow === "INVESTING" || account.cashFlow === "FINANCING") {
    return account.cashFlow;
  }
  const ojk = account.ojkMap ?? "";
  if (ojk.startsWith("PENDAPATAN_") || ojk.startsWith("BEBAN_")) return "OPERATING";
  if (ojk === "ASET_PIUTANG_PINJAMAN" || ojk === "ASET_CADANGAN_RISIKO") return "OPERATING";
  if (ojk === "KEWAJIBAN_SIMPANAN" || ojk === "KEWAJIBAN_POTONGAN_GAJI") return "OPERATING";
  if (ojk === "KEWAJIBAN_DANA_SHU") return "FINANCING";
  if (ojk.startsWith("ASET_LANCAR_")) return "OPERATING";
  if (ojk.startsWith("EKUITAS_")) return "FINANCING";

  const code = account.code ?? account.accountCode ?? "";
  const group = code.slice(0, 2);
  if (account.classCode === "4" || account.classCode === "5") return "OPERATING";
  if (group === "12" || group === "21") return "OPERATING";
  if (account.classCode === "1") return "INVESTING";
  return "FINANCING";
}

export function summarizeCashFlow(
  lines: Array<{
    accountCode: string;
    isCash: boolean;
    classCode: string;
    debit: number;
    credit: number;
    cashFlow?: string | null;
    ojkMap?: string | null;
  }>,
) {
  const buckets = { OPERATING: 0, INVESTING: 0, FINANCING: 0 };
  const cash = lines.filter((l) => l.isCash);
  const nonCash = lines.filter((l) => !l.isCash);
  const cashNet = roundMoney(cash.reduce((sum, line) => sum + line.debit - line.credit, 0));
  if (!nonCash.length) {
    buckets.OPERATING = cashNet;
    return buckets;
  }
  const weights = nonCash.map((line) => Math.abs(line.debit - line.credit));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (!totalWeight) {
    buckets[classifyCashFlow(nonCash[0])] = cashNet;
    return buckets;
  }
  nonCash.forEach((line, i) => {
    const flow = classifyCashFlow({
      code: line.accountCode,
      classCode: line.classCode,
      cashFlow: line.cashFlow,
      ojkMap: line.ojkMap,
    });
    buckets[flow] = roundMoney(buckets[flow] + cashNet * (weights[i] / totalWeight));
  });
  return buckets;
}
