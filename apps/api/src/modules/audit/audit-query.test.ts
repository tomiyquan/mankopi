import assert from "node:assert/strict";
import { test } from "node:test";
import { auditListWhere, parseAuditPage, parseAuditPageSize } from "./audit-query";

test("halaman dan ukuran dibatasi", () => {
  assert.equal(parseAuditPage(), 1);
  assert.equal(parseAuditPage("0"), 1);
  assert.equal(parseAuditPage("3.9"), 3);
  assert.equal(parseAuditPageSize(), 20);
  assert.equal(parseAuditPageSize("8"), 8);
  assert.equal(parseAuditPageSize("500"), 100);
});

test("filter pencarian mencakup aksi, sumber, dan pelaku", () => {
  assert.deepEqual(auditListWhere("t1"), { tenantId: "t1" });
  const where = auditListWhere("t1", "  setor  ");
  assert.equal(where.tenantId, "t1");
  assert.ok(Array.isArray(where.OR));
  assert.equal(where.OR?.length, 5);
  assert.deepEqual(auditListWhere(undefined, "   "), {});
});
