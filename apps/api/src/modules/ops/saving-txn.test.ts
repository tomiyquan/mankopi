import assert from "node:assert/strict";
import { test } from "node:test";
import { formatSavingTxnNo, parseSavingMethod, savingMethodError, savingNoteError, savingTransferError } from "./saving-txn";

test("nomor bukti simpanan berpola SM-0001", () => {
  assert.equal(formatSavingTxnNo(1), "SM-0001");
  assert.equal(formatSavingTxnNo(12), "SM-0012");
});

test("metode setor tarik hanya tunai, bank, atau pindah buku", () => {
  assert.equal(parseSavingMethod("cash"), "CASH");
  assert.equal(savingMethodError("WIRE"), "Metode harus tunai, bank, atau pindah buku rekening");
  assert.equal(savingNoteError("x".repeat(501)), "Catatan transaksi maksimal 500 karakter");
  assert.equal(savingTransferError("CASH", "a"), null);
  assert.ok(savingTransferError("TRANSFER", "a"));
  assert.ok(savingTransferError("TRANSFER", "a", "a"));
  assert.equal(savingTransferError("TRANSFER", "a", "b"), null);
});
