import assert from "node:assert/strict";
import { test } from "node:test";
import { allocatePayment, spreadPayment } from "./allocation";
import { applyRollover, mergeCalendar } from "./calendar";
import { gradeCollectability } from "./collectability";
import { computePenalty } from "./penalty";
import { generateSchedule } from "./schedule";

test("flat schedule balances to principal", () => {
  const items = generateSchedule({
    principal: 1_200_000,
    annualRate: 0.24,
    periods: 12,
    method: "FLAT",
    frequency: "MONTHLY",
    startDate: "2026-01-15",
  });
  const principal = items.reduce((sum, i) => sum + i.principalDue, 0);
  assert.equal(Math.round(principal), 1_200_000);
  assert.equal(items.length, 12);
});

test("allocation follows penalty then interest then principal", () => {
  const result = allocatePayment(15_000, { penalty: 5_000, interest: 8_000, principal: 20_000 });
  assert.equal(result.penalty, 5_000);
  assert.equal(result.interest, 8_000);
  assert.equal(result.principal, 2_000);
  assert.equal(result.leftover, 0);
});

test("setoran besar menutup beberapa angsuran berurutan", () => {
  const { items, leftover, totals } = spreadPayment(50_000, [
    { id: "a", penalty: 0, interest: 5_000, principal: 20_000 },
    { id: "b", penalty: 0, interest: 5_000, principal: 20_000 },
    { id: "c", penalty: 0, interest: 5_000, principal: 20_000 },
  ]);
  assert.equal(items.length, 2);
  assert.equal(items[0].principal, 20_000);
  assert.equal(items[1].principal, 20_000);
  assert.equal(leftover, 0);
  assert.equal(totals.principal, 40_000);
  assert.equal(totals.interest, 10_000);
});

test("collectability grades macet after a year", () => {
  assert.equal(gradeCollectability(0), 1);
  assert.equal(gradeCollectability(91), 3);
  assert.equal(gradeCollectability(400), 5);
});

test("bunga total dari pokok dibagi merata ke tenor", () => {
  const items = generateSchedule({
    principal: 1_000_000,
    annualRate: 0.1,
    rateBasis: "PRINCIPAL_TOTAL",
    periods: 10,
    method: "DECLINING",
    frequency: "MONTHLY",
    startDate: "2026-01-15",
  });
  const interest = items.reduce((sum, i) => sum + i.interestDue, 0);
  assert.equal(Math.round(interest), 100_000);
  assert.equal(items[0].interestDue, 10_000);
});

test("bunga harian flat mengikuti hari per angsuran", () => {
  const items = generateSchedule({
    principal: 1_000_000,
    annualRate: 0.001,
    rateBasis: "DAILY",
    periods: 4,
    method: "FLAT",
    frequency: "WEEKLY",
    startDate: "2026-01-15",
  });
  assert.equal(items[0].interestDue, 7_000);
});

test("bunga harian menurun dihitung dari sisa pokok", () => {
  const items = generateSchedule({
    principal: 1_000_000,
    annualRate: 0.001,
    rateBasis: "DAILY",
    periods: 2,
    method: "DECLINING",
    frequency: "MONTHLY",
    startDate: "2026-01-15",
  });
  assert.equal(items[0].interestDue, 30_000);
  assert.equal(items[1].interestDue, 15_000);
});

test("denda menunggu habis toleransi lalu naik per hari", () => {
  assert.equal(
    computePenalty({
      dueDate: "2026-09-01",
      asOf: "2026-09-03",
      graceDays: 3,
      kind: "FIXED_PER_DAY",
      value: 1000,
      installment: 25_000,
    }),
    0,
  );
  assert.equal(
    computePenalty({
      dueDate: "2026-09-01",
      asOf: "2026-09-05",
      graceDays: 3,
      kind: "FIXED_PER_DAY",
      value: 1000,
      installment: 25_000,
    }),
    1000,
  );
  assert.equal(
    computePenalty({
      dueDate: "2026-09-01",
      asOf: "2026-09-05",
      graceDays: 0,
      kind: "PERCENT_INSTALLMENT",
      value: 0.1,
      installment: 25_000,
    }),
    2500,
  );
});

test("holiday rollover moves off Independence Day", () => {
  const calendar = mergeCalendar();
  assert.equal(applyRollover("2026-08-17", calendar, "FORWARD"), "2026-08-18");
});
