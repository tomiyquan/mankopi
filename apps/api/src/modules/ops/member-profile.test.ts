import assert from "node:assert/strict";
import { test } from "node:test";
import { memberProfileError } from "./member-profile";

const valid = {
  nik: "3201010101010001",
  name: "Tomi Prasetyo",
  gender: "MALE",
  placeOfBirth: "Bandung",
  dateOfBirth: "1990-01-15",
  motherName: "Siti Aminah",
  phone: "081234567890",
  address: "Jl. Merdeka 1",
  occupation: "Wiraswasta",
};

test("pendaftaran menolak identitas tipis", () => {
  assert.ok(memberProfileError({ nik: "123", name: "A" }, "create"));
  assert.ok(memberProfileError({ ...valid, dateOfBirth: undefined }, "create"));
  assert.ok(memberProfileError({ ...valid, occupation: "" }, "create"));
});

test("pendaftaran lengkap diterima", () => {
  assert.equal(memberProfileError(valid, "create"), null);
});

test("umur di bawah 17 ditolak", () => {
  assert.ok(memberProfileError({ ...valid, dateOfBirth: "2020-01-01" }, "create"));
});

test("ubah sebagian tidak memaksa seluruh berkas", () => {
  assert.equal(memberProfileError({ phone: "081298765432", city: "Bekasi" }, "update"), null);
  assert.ok(memberProfileError({ email: "bukan-email" }, "update"));
});
