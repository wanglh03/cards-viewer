export type InterestUnit = "day" | "month" | "year";

const DAYS_PER_YEAR = 365;
const MONTHS_PER_YEAR = 12;

export function termInYears(value: number, unit: InterestUnit) {
  if (unit === "day") return value / DAYS_PER_YEAR;
  if (unit === "month") return value / MONTHS_PER_YEAR;
  return value;
}

export function termInMonths(value: number, unit: InterestUnit) {
  if (unit === "day") return value / (DAYS_PER_YEAR / MONTHS_PER_YEAR);
  if (unit === "month") return value;
  return value * MONTHS_PER_YEAR;
}

export function calculateDepositInterest({
  principalWan,
  annualRate,
  term,
  unit,
}: {
  principalWan: number;
  annualRate: number;
  term: number;
  unit: InterestUnit;
}) {
  const principal = Math.max(0, principalWan) * 10_000;
  const years = termInYears(Math.max(0, term), unit);
  const months = termInMonths(Math.max(0, term), unit);
  const interest = principal * (Math.max(0, annualRate) / 100) * years;
  return {
    interest,
    maturityAmount: principal + interest,
    monthlyInterest: months > 0 ? interest / months : 0,
    yieldRate: principal > 0 ? (interest / principal) * 100 : 0,
    months,
  };
}
