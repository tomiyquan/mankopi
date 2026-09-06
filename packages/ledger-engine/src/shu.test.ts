import assert from "node:assert/strict";
import { test } from "node:test";
import { allocateShu, assessBudget, budgetCap, requiredCkpn } from "./shu";

test("budget blocks expense over income portion", () => {
  assert.equal(budgetCap(10_000_000, 25), 2_500_000);
  const ok = assessBudget({ income: 10_000_000, percent: 30, spent: 2_000_000, adding: 500_000 });
  assert.equal(ok.ok, true);
  const over = assessBudget({ income: 10_000_000, percent: 30, spent: 2_000_000, adding: 1_200_000 });
  assert.equal(over.ok, false);
  assert.equal(over.cap, 3_000_000);
});

test("CKPN follows collectability rates", () => {
  const result = requiredCkpn(
    [
      { outstanding: 2_000_000, collectability: 1 },
      { outstanding: 500_000, collectability: 3 },
    ],
    [
      { grade: 1, percent: 0.5 },
      { grade: 3, percent: 10 },
    ],
  );
  assert.equal(result.required, 60_000);
});

test("SHU allocation uses last line as remainder", () => {
  const parts = allocateShu(100, [
    { accountCode: "3202", percent: 25 },
    { accountCode: "2103", percent: 40 },
    { accountCode: "2107", percent: 35 },
  ]);
  assert.equal(parts.reduce((s, p) => s + p.amount, 0), 100);
  assert.throws(() => allocateShu(100, [{ accountCode: "3202", percent: 40 }]));
});
