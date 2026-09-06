import assert from "node:assert/strict";
import { test } from "node:test";
import { formatRupiahInput, rupiahDigits } from "./money";

function typeRupiah(keys: string) {
  let digits = "";
  for (const key of keys) {
    digits = rupiahDigits(`${formatRupiahInput(digits)}${key}`);
  }
  return digits;
}

test("ketikan setelah titik ribuan tidak mereset nominal", () => {
  assert.equal(typeRupiah("10000"), "10000");
  assert.equal(formatRupiahInput("10000"), "10.000");
  assert.equal(typeRupiah("5000000"), "5000000");
  assert.equal(formatRupiahInput("5000000"), "5.000.000");
});

test("titik yang diketik tetap menjaga angka yang sudah ada", () => {
  assert.equal(rupiahDigits("5."), "5");
  assert.equal(rupiahDigits("1.0000"), "10000");
  assert.equal(rupiahDigits("5.000.000"), "5000000");
});

test("nilai API desimal Inggris tetap dibulatkan ke rupiah utuh", () => {
  assert.equal(rupiahDigits("1500000.00"), "1500000");
  assert.equal(rupiahDigits(1_500_000.4), "1500000");
});
