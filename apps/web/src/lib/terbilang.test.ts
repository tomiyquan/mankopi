import assert from "node:assert/strict";
import { test } from "node:test";
import { terbilang, terbilangRupiah } from "./terbilang";

test("terbilang angka Indonesia untuk kwitansi", () => {
  assert.equal(terbilang(0), "nol");
  assert.equal(terbilang(11), "sebelas");
  assert.equal(terbilang(21), "dua puluh satu");
  assert.equal(terbilang(1000), "seribu");
  assert.equal(terbilang(2500), "dua ribu lima ratus");
  assert.equal(terbilang(100_000), "seratus ribu");
  assert.equal(terbilangRupiah(2_000_000), "dua juta rupiah");
});
