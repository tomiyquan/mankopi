import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_COA_TEMPLATE } from "./coa";
import { assertJournal } from "./journal";
import { classifyCashFlow, splitStatements, summarizeCashFlow, trialBalance } from "./reports";

test("rejects unbalanced journal", () => {
  assert.throws(() =>
    assertJournal({
      sourceType: "manual",
      sourceId: "1",
      periodOpen: true,
      lines: [
        { accountCode: "1101", debit: 100, credit: 0 },
        { accountCode: "4101", debit: 0, credit: 90 },
      ],
    }),
  );
});

test("accepts balanced collection-style journal", () => {
  const result = assertJournal({
    sourceType: "collection",
    sourceId: "rcpt-1",
    periodOpen: true,
    lines: [
      { accountCode: "1101", debit: 110_000, credit: 0 },
      { accountCode: "1201", debit: 0, credit: 100_000 },
      { accountCode: "4101", debit: 0, credit: 10_000 },
    ],
  });
  assert.equal(result.debit, 110_000);
});

test("blocks posting into a closed period", () => {
  assert.throws(() =>
    assertJournal({
      sourceType: "manual",
      sourceId: "1",
      periodOpen: false,
      lines: [
        { accountCode: "1101", debit: 1, credit: 0 },
        { accountCode: "4101", debit: 0, credit: 1 },
      ],
    }),
  );
});

test("default COA maps to OJK and splits neraca vs PHU", () => {
  assert.ok(DEFAULT_COA_TEMPLATE.every((a) => a.ojkMap));
  const rows = DEFAULT_COA_TEMPLATE.map((a) => ({ accountCode: a.code, debit: 0, credit: 0 }));
  const { neraca, phu } = splitStatements(rows);
  assert.ok(neraca.length >= 5);
  assert.ok(phu.length >= 2);
  assert.equal(trialBalance(rows).balanced, true);
});

test("KSP cash flow: loan and savings are operating, capital is financing", () => {
  assert.equal(classifyCashFlow({ classCode: "1", accountCode: "1201", ojkMap: "ASET_PIUTANG_PINJAMAN" }), "OPERATING");
  assert.equal(classifyCashFlow({ classCode: "2", accountCode: "2101", ojkMap: "KEWAJIBAN_SIMPANAN" }), "OPERATING");
  assert.equal(classifyCashFlow({ classCode: "3", accountCode: "3103", ojkMap: "EKUITAS_MODAL" }), "FINANCING");
  assert.equal(classifyCashFlow({ classCode: "1", accountCode: "1301" }), "INVESTING");

  const disbursement = summarizeCashFlow([
    { accountCode: "1101", classCode: "1", isCash: true, debit: 0, credit: 2_500_000 },
    { accountCode: "1201", classCode: "1", isCash: false, ojkMap: "ASET_PIUTANG_PINJAMAN", debit: 2_500_000, credit: 0 },
  ]);
  assert.equal(disbursement.OPERATING, -2_500_000);
  assert.equal(disbursement.INVESTING, 0);

  const capital = summarizeCashFlow([
    { accountCode: "1101", classCode: "1", isCash: true, debit: 5_000_000, credit: 0 },
    { accountCode: "3103", classCode: "3", isCash: false, ojkMap: "EKUITAS_MODAL", debit: 0, credit: 5_000_000 },
  ]);
  assert.equal(capital.FINANCING, 5_000_000);
  assert.equal(capital.OPERATING, 0);
});
