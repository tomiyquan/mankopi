import assert from "node:assert/strict";
import { test } from "node:test";
import { memberExitError, memberRestoreError } from "./member-exit";

test("berhenti ditolak jika masih ada pinjaman berjalan", () => {
  assert.ok(
    memberExitError({
      status: "ACTIVE",
      loans: [{ status: "DISBURSED" }],
      reason: "Pindah kota kerja",
      leftOn: "2026-09-07",
    }),
  );
  assert.ok(
    memberExitError({
      status: "ACTIVE",
      loans: [{ status: "DRAFT" }],
      reason: "Pindah kota kerja",
    }),
  );
});

test("berhenti diterima jika pinjaman sudah selesai", () => {
  assert.equal(
    memberExitError({
      status: "ACTIVE",
      loans: [{ status: "CLOSED" }, { status: "REJECTED" }],
      reason: "Mengundurkan diri karena pindah",
      leftOn: "2026-09-07",
    }),
    null,
  );
});

test("alasan berhenti wajib dan anggota yang sudah berhenti ditolak", () => {
  assert.ok(memberExitError({ status: "ACTIVE", loans: [], reason: "singkat" }));
  assert.ok(memberExitError({ status: "LEFT", loans: [], reason: "Mengundurkan diri karena pindah" }));
});

test("aktifkan kembali hanya untuk yang sudah berhenti", () => {
  assert.equal(memberRestoreError("LEFT"), null);
  assert.ok(memberRestoreError("ACTIVE"));
});
