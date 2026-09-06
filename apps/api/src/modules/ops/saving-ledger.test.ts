import assert from "node:assert/strict";
import { test } from "node:test";
import { applySavingMovement, formatSavingAccountNo, withSavingRunningBalance } from "./saving-ledger";

test("nomor rekening berpola SMP-0001", () => {
  assert.equal(formatSavingAccountNo(1), "SMP-0001");
  assert.equal(formatSavingAccountNo(12), "SMP-0012");
});

test("buku rekening menghitung saldo berjalan per mutasi", () => {
  const ledger = withSavingRunningBalance([
    { type: "SETOR", amount: 100_000 },
    { type: "SETOR", amount: 50_000 },
    { type: "TARIK", amount: 25_000 },
  ]);
  assert.deepEqual(
    ledger.map((row) => row.balanceAfter),
    [100_000, 150_000, 125_000],
  );
  assert.equal(applySavingMovement(125_000, "SETOR", 5_000), 130_000);
});
