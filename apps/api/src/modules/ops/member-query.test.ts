import assert from "node:assert/strict";
import { test } from "node:test";
import { memberListWhere, parseMemberPage, parseMemberPageSize, parseMemberStatus } from "./member-query";

test("halaman anggota dibatasi", () => {
  assert.equal(parseMemberPage("2"), 2);
  assert.equal(parseMemberPage("0"), 1);
  assert.equal(parseMemberPageSize("500"), 100);
  assert.equal(parseMemberStatus("left"), "LEFT");
  assert.equal(parseMemberStatus("ALL"), undefined);
});

test("filter daftar anggota memakai status dan kata kunci", () => {
  assert.deepEqual(memberListWhere("t1"), { tenantId: "t1" });
  const where = memberListWhere("t1", "  tomi  ", "ACTIVE");
  assert.equal(where.tenantId, "t1");
  assert.equal(where.status, "ACTIVE");
  assert.ok(Array.isArray(where.OR));
  assert.equal(where.OR?.length, 6);
});
