import type { PenaltyKind } from "@mankopi/shared";
import { roundMoney } from "./interest";

export type PenaltyInput = {
  dueDate: string;
  asOf: string;
  graceDays: number;
  kind: PenaltyKind;
  value: number;
  installment: number;
};

export function calendarDaysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`);
  return Math.floor((to - from) / 86_400_000);
}

export function penaltyDays(dueDate: string, asOf: string, graceDays: number): number {
  return Math.max(0, calendarDaysBetween(dueDate, asOf) - Math.max(0, Math.floor(graceDays)));
}

export function computePenalty(input: PenaltyInput): number {
  if (input.kind === "NONE" || !(input.value > 0)) return 0;
  const late = penaltyDays(input.dueDate, input.asOf, input.graceDays);
  if (late <= 0) return 0;
  const installment = Math.max(0, input.installment);
  if (input.kind === "FIXED_ONCE") return roundMoney(input.value);
  if (input.kind === "FIXED_PER_DAY") return roundMoney(input.value * late);
  if (input.kind === "PERCENT_INSTALLMENT") return roundMoney(installment * input.value);
  if (input.kind === "PERCENT_INSTALLMENT_PER_DAY") return roundMoney(installment * input.value * late);
  return 0;
}

export function nextPenaltyDue(currentDue: number, computed: number, alreadyPaid: number): number {
  return roundMoney(Math.max(currentDue, computed, alreadyPaid));
}
