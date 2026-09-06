import type { PaymentBucket } from "@mankopi/shared";
import { PAYMENT_ALLOCATION_DEFAULT } from "@mankopi/shared";
import { roundMoney } from "./interest";

export type OutstandingBuckets = {
  penalty: number;
  interest: number;
  principal: number;
};

export type AllocationResult = OutstandingBuckets & {
  leftover: number;
  order: PaymentBucket[];
};

export function allocatePayment(
  amount: number,
  outstanding: OutstandingBuckets,
  order: readonly PaymentBucket[] = PAYMENT_ALLOCATION_DEFAULT,
): AllocationResult {
  let remaining = roundMoney(amount);
  const paid: OutstandingBuckets = { penalty: 0, interest: 0, principal: 0 };
  const due: Record<PaymentBucket, number> = {
    PENALTY: outstanding.penalty,
    INTEREST: outstanding.interest,
    PRINCIPAL: outstanding.principal,
  };

  for (const bucket of order) {
    const take = Math.min(remaining, due[bucket]);
    if (bucket === "PENALTY") paid.penalty = take;
    if (bucket === "INTEREST") paid.interest = take;
    if (bucket === "PRINCIPAL") paid.principal = take;
    remaining = roundMoney(remaining - take);
  }

  return { ...paid, leftover: remaining, order: [...order] };
}

export type ScheduleDue = {
  id: string;
  penalty: number;
  interest: number;
  principal: number;
};

export function spreadPayment(amount: number, items: ScheduleDue[]) {
  let remaining = roundMoney(amount);
  const applied: Array<ScheduleDue> = [];
  const totals: OutstandingBuckets = { penalty: 0, interest: 0, principal: 0 };
  for (const item of items) {
    if (remaining <= 0) break;
    const alloc = allocatePayment(remaining, item);
    if (alloc.penalty + alloc.interest + alloc.principal <= 0) {
      remaining = alloc.leftover;
      continue;
    }
    applied.push({ id: item.id, penalty: alloc.penalty, interest: alloc.interest, principal: alloc.principal });
    totals.penalty = roundMoney(totals.penalty + alloc.penalty);
    totals.interest = roundMoney(totals.interest + alloc.interest);
    totals.principal = roundMoney(totals.principal + alloc.principal);
    remaining = alloc.leftover;
  }
  return { items: applied, leftover: remaining, totals: { ...totals, leftover: remaining } };
}
