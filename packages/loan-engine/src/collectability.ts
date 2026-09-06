import type { Collectability } from "@mankopi/shared";

/** Bucket hari tunggakan gaya KSP/OJK (1 lancar … 5 macet). */
export const DEFAULT_COLLECTABILITY_BUCKETS = [
  { maxDays: 0, grade: 1 as Collectability },
  { maxDays: 90, grade: 2 as Collectability },
  { maxDays: 180, grade: 3 as Collectability },
  { maxDays: 360, grade: 4 as Collectability },
  { maxDays: Number.POSITIVE_INFINITY, grade: 5 as Collectability },
];

export function gradeCollectability(
  daysOverdue: number,
  buckets = DEFAULT_COLLECTABILITY_BUCKETS,
): Collectability {
  const safe = Math.max(0, daysOverdue);
  const match = buckets.find((b) => safe <= b.maxDays);
  return match?.grade ?? 5;
}
