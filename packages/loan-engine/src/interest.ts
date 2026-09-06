import type { InstallmentFrequency, InterestMethod, RateBasis } from "@mankopi/shared";

export type InterestInput = {
  principal: number;
  annualRate: number;
  periods: number;
  method: InterestMethod;
  daysInYear?: number;
};

export const PERIOD_DAYS: Record<InstallmentFrequency, number> = {
  DAILY: 1,
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
};

export function periodRate(annualRate: number, periodsPerYear: number): number {
  return annualRate / periodsPerYear;
}

export function periodRateForBasis(rate: number, rateBasis: RateBasis, frequency: InstallmentFrequency): number {
  const days = PERIOD_DAYS[frequency];
  const periodsPerYear = frequency === "MONTHLY" ? 12 : Math.round(365 / days);
  if (rateBasis === "DAILY") return rate * days;
  if (rateBasis === "PRINCIPAL_TOTAL") return 0;
  return periodRate(rate, periodsPerYear);
}

export function totalEqualInterest(
  principal: number,
  rate: number,
  rateBasis: RateBasis,
  periods: number,
  frequency: InstallmentFrequency,
): number {
  if (rateBasis === "PRINCIPAL_TOTAL") return roundMoney(principal * rate);
  if (rateBasis === "DAILY") return roundMoney(principal * rate * PERIOD_DAYS[frequency] * periods);
  return roundMoney(principal * rate * (periods / 12));
}

export function equalInterestEach(
  principal: number,
  rate: number,
  rateBasis: RateBasis,
  periods: number,
  frequency: InstallmentFrequency,
): number {
  return roundMoney(totalEqualInterest(principal, rate, rateBasis, periods, frequency) / periods);
}

export function annuityPayment(principal: number, rate: number, periods: number): number {
  if (rate === 0) return roundMoney(principal / periods);
  const factor = (rate * (1 + rate) ** periods) / ((1 + rate) ** periods - 1);
  return roundMoney(principal * factor);
}

export function totalInterest(input: InterestInput): number {
  const { principal, annualRate, periods, method, daysInYear = 365 } = input;
  if (method === "FLAT") {
    return roundMoney(principal * annualRate * (periods / 12));
  }
  if (method === "DAILY_EFFECTIVE") {
    const daily = (1 + annualRate) ** (1 / daysInYear) - 1;
    return roundMoney(principal * ((1 + daily) ** periods - 1));
  }
  let balance = principal;
  let interest = 0;
  const rate = periodRate(annualRate, method === "ANNUITY" ? 12 : 12);
  if (method === "ANNUITY") {
    const pmt = annuityPayment(principal, rate, periods);
    for (let i = 0; i < periods; i += 1) {
      const iAmt = roundMoney(balance * rate);
      interest += iAmt;
      balance = roundMoney(balance - (pmt - iAmt));
    }
    return roundMoney(interest);
  }
  const principalPart = principal / periods;
  for (let i = 0; i < periods; i += 1) {
    interest += roundMoney(balance * rate);
    balance = roundMoney(balance - principalPart);
  }
  return roundMoney(interest);
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
