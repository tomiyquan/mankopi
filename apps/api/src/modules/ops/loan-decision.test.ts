import assert from "node:assert/strict";
import { test } from "node:test";
import {
  loanDecisionAuditAction,
  loanDecisionError,
  loanStatusFromDecision,
} from "./loan-decision";

test("putusan butuh jenis dan keterangan", () => {
  assert.ok(loanDecisionError({}));
  assert.ok(loanDecisionError({ decision: "APPROVED", note: "ok" }));
  assert.equal(loanDecisionError({ decision: "APPROVED", note: "Anggota lancar dan simpanan cukup" }), null);
});

test("bersyarat wajib isi syarat", () => {
  assert.ok(loanDecisionError({ decision: "CONDITIONAL", note: "Layak dengan catatan operasional" }));
  assert.equal(
    loanDecisionError({
      decision: "CONDITIONAL",
      note: "Layak dengan catatan operasional",
      conditions: "Bayar simpanan wajib tertunggak sebelum cair",
    }),
    null,
  );
});

test("status dan jejak audit mengikuti putusan", () => {
  assert.equal(loanStatusFromDecision("APPROVED"), "APPROVED");
  assert.equal(loanStatusFromDecision("CONDITIONAL"), "APPROVED");
  assert.equal(loanStatusFromDecision("REJECTED"), "REJECTED");
  assert.equal(loanDecisionAuditAction("CONDITIONAL"), "credit.loan.approved_conditional");
  assert.equal(loanDecisionAuditAction("REJECTED"), "credit.loan.rejected");
});
