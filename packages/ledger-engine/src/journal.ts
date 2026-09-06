import { ERROR_CODES } from "@mankopi/shared";

export type JournalLineInput = {
  accountCode: string;
  debit: number;
  credit: number;
  memo?: string;
};

export type JournalInput = {
  sourceType: string;
  sourceId: string;
  periodOpen: boolean;
  lines: JournalLineInput[];
};

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function assertJournal(input: JournalInput): { debit: number; credit: number } {
  if (!input.periodOpen) {
    throw Object.assign(new Error("Accounting period is closed"), {
      code: ERROR_CODES.PERIOD_CLOSED,
    });
  }
  if (input.lines.length < 2) {
    throw Object.assign(new Error("Journal needs at least two lines"), {
      code: ERROR_CODES.JOURNAL_UNBALANCED,
    });
  }
  let debit = 0;
  let credit = 0;
  for (const line of input.lines) {
    if (line.debit < 0 || line.credit < 0 || (line.debit > 0 && line.credit > 0)) {
      throw Object.assign(new Error("Line must be debit or credit, never both"), {
        code: ERROR_CODES.JOURNAL_UNBALANCED,
      });
    }
    debit += line.debit;
    credit += line.credit;
  }
  debit = roundMoney(debit);
  credit = roundMoney(credit);
  if (debit !== credit || debit === 0) {
    throw Object.assign(new Error("Journal is unbalanced"), {
      code: ERROR_CODES.JOURNAL_UNBALANCED,
    });
  }
  return { debit, credit };
}
