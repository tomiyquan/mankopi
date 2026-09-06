import type { HolidayRollover, InstallmentFrequency, InterestMethod, RateBasis } from "@mankopi/shared";
import { applyRollover, mergeCalendar, type Holiday } from "./calendar";
import { annuityPayment, equalInterestEach, periodRateForBasis, PERIOD_DAYS, roundMoney, totalEqualInterest } from "./interest";

export type ScheduleItem = {
  sequence: number;
  dueDate: string;
  principalDue: number;
  interestDue: number;
  totalDue: number;
  remainingPrincipal: number;
};

export type ScheduleInput = {
  principal: number;
  annualRate: number;
  periods: number;
  method: InterestMethod;
  rateBasis?: RateBasis;
  frequency: InstallmentFrequency;
  startDate: string;
  holidays?: Holiday[];
  rollover?: HolidayRollover;
};

export function addFrequency(isoDate: string, frequency: InstallmentFrequency, step: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (frequency === "MONTHLY") {
    date.setUTCMonth(date.getUTCMonth() + step);
  } else {
    date.setUTCDate(date.getUTCDate() + PERIOD_DAYS[frequency] * step);
  }
  return date.toISOString().slice(0, 10);
}

export function generateSchedule(input: ScheduleInput): ScheduleItem[] {
  const calendar = mergeCalendar(input.holidays);
  const rollover = input.rollover ?? "FORWARD";
  const rateBasis = input.rateBasis ?? "ANNUAL";
  const items: ScheduleItem[] = [];
  let balance = input.principal;
  const rate = periodRateForBasis(input.annualRate, rateBasis, input.frequency);

  if (input.method === "FLAT" || rateBasis === "PRINCIPAL_TOTAL") {
    const interestEach = equalInterestEach(input.principal, input.annualRate, rateBasis, input.periods, input.frequency);
    const interestTotal = totalEqualInterest(input.principal, input.annualRate, rateBasis, input.periods, input.frequency);
    const principalEach = roundMoney(input.principal / input.periods);
    let interestLeft = interestTotal;
    for (let i = 1; i <= input.periods; i += 1) {
      const rawPrincipal = i === input.periods ? roundMoney(balance) : principalEach;
      const interestDue = i === input.periods ? interestLeft : interestEach;
      balance = roundMoney(balance - rawPrincipal);
      interestLeft = roundMoney(interestLeft - interestDue);
      const dueDate = applyRollover(addFrequency(input.startDate, input.frequency, i), calendar, rollover);
      items.push({
        sequence: i,
        dueDate,
        principalDue: rawPrincipal,
        interestDue,
        totalDue: roundMoney(rawPrincipal + interestDue),
        remainingPrincipal: Math.max(balance, 0),
      });
    }
    return items;
  }

  const pmt =
    input.method === "ANNUITY" ? annuityPayment(input.principal, rate, input.periods) : null;

  for (let i = 1; i <= input.periods; i += 1) {
    const interestDue = roundMoney(balance * rate);
    let principalDue: number;
    if (pmt) {
      principalDue = i === input.periods ? balance : roundMoney(pmt - interestDue);
    } else {
      principalDue = i === input.periods ? balance : roundMoney(input.principal / input.periods);
    }
    balance = roundMoney(Math.max(balance - principalDue, 0));
    items.push({
      sequence: i,
      dueDate: applyRollover(addFrequency(input.startDate, input.frequency, i), calendar, rollover),
      principalDue,
      interestDue,
      totalDue: roundMoney(principalDue + interestDue),
      remainingPrincipal: balance,
    });
  }
  return items;
}
