import assert from "node:assert/strict";
import { test } from "node:test";
import {
  changeLoanTermsError,
  changeSavingAccountError,
  deactivateMembershipError,
  loanEligibilityError,
  loanLimitError,
  membershipPaidError,
  parseSavingKind,
  parseTenantPolicy,
  productCodeError,
  requiredAccountClass,
  savingAccountMapError,
  savingDepositError,
  savingWithdrawError,
  uniqueMembershipError,
} from "./product-policy";

test("kode produk ditolak jika tidak seragam", () => {
  assert.ok(productCodeError("a"));
  assert.equal(productCodeError("POKOK"), null);
  assert.equal(productCodeError("REG-12"), null);
});

test("pokok dan wajib hanya satu yang aktif", () => {
  assert.ok(uniqueMembershipError("POKOK", 1));
  assert.equal(uniqueMembershipError("SUKARELA", 3), null);
  assert.ok(deactivateMembershipError("WAJIB", 0));
  assert.equal(deactivateMembershipError("WAJIB", 1), null);
});

test("pemetaan akun mengikuti jenis simpanan", () => {
  assert.equal(requiredAccountClass("POKOK"), "3");
  assert.equal(requiredAccountClass("SUKARELA"), "2");
  assert.ok(savingAccountMapError("POKOK", "2"));
  assert.equal(savingAccountMapError("SUKARELA", "2"), null);
});

test("setor pokok tepat sisa kewajiban, wajib dan sukarela ikut minimum", () => {
  assert.ok(savingDepositError("POKOK", 100000, 0, 50000));
  assert.equal(savingDepositError("POKOK", 100000, 0, 100000), null);
  assert.ok(savingDepositError("POKOK", 100000, 100000, 100000));
  assert.ok(savingDepositError("WAJIB", 25000, 0, 10000));
  assert.equal(savingDepositError("SUKARELA", 0, 0, 1), null);
});

test("tarik mengikuti flag data induk, bukan jenis produk", () => {
  assert.ok(savingWithdrawError(false, 100000, 10000));
  assert.ok(savingWithdrawError(true, 5000, 6000));
  assert.equal(savingWithdrawError(true, 5000, 5000), null);
});

test("batas pokok dan kelayakan pinjaman", () => {
  assert.ok(loanLimitError(1000, 500000, 10_000_000));
  assert.ok(loanLimitError(20_000_000, 500000, 10_000_000));
  assert.equal(loanLimitError(1_000_000, 500000, 10_000_000), null);
  assert.ok(loanEligibilityError(true, false));
  assert.equal(loanEligibilityError(true, true), null);
  assert.ok(changeLoanTermsError(true));
  assert.ok(changeSavingAccountError(true));
  assert.equal(parseSavingKind("wajib"), "WAJIB");
});

test("kebijakan pinjaman default koperasi: pokok wajib, wajib opsional", () => {
  assert.deepEqual(parseTenantPolicy({}), { requirePokokForLoan: true, requireWajibForLoan: false });
  assert.equal(parseTenantPolicy({ requirePokokForLoan: false }).requirePokokForLoan, false);
  assert.equal(membershipPaidError("wajib", true, false), "Lunasi simpanan wajib sebelum mengajukan pinjaman");
  assert.equal(membershipPaidError("wajib", false, false), null);
});
