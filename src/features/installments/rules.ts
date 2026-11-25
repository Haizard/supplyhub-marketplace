export type InstallmentFrequencyInput = "WEEKLY" | "BIWEEKLY" | "MONTHLY";
export type DepositModeInput = "FIXED" | "PERCENTAGE";

export interface InstallmentTermsInput {
  cashPrice: number;
  interestAmount: number;
  extraCharges: number;
  depositMode: DepositModeInput;
  depositValue: number;
  frequency: InstallmentFrequencyInput;
  installmentCount: number;
  firstDueDate: Date;
}

export interface ScheduleEntry {
  sequence: number;
  dueDate: Date;
  amount: number;
}

export interface CalculatedTerms {
  depositAmount: number;
  totalPayable: number;
  outstandingBalance: number;
  installmentAmount: number;
  schedule: ScheduleEntry[];
}

export class InstallmentTermsError extends Error {}

const toCents = (value: number): number => Math.round(value * 100);
const toMajor = (cents: number): number => Math.round(cents) / 100;

function addInterval(date: Date, frequency: InstallmentFrequencyInput, sequence: number): Date {
  const result = new Date(date.getTime());
  if (frequency === "MONTHLY") {
    const day = result.getUTCDate();
    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + sequence);
    const lastDay = new Date(
      Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
    ).getUTCDate();
    result.setUTCDate(Math.min(day, lastDay));
    return result;
  }
  const days = (frequency === "WEEKLY" ? 7 : 14) * sequence;
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Pure money/schedule calculation in integer minor units. The final instalment
 * absorbs any rounding remainder so the generated schedule always sums exactly
 * to the outstanding balance. No interest or late charges are implied here.
 */
export function calculateInstallmentTerms(input: InstallmentTermsInput): CalculatedTerms {
  const cashCents = toCents(input.cashPrice);
  const interestCents = toCents(input.interestAmount);
  const chargesCents = toCents(input.extraCharges);
  if (cashCents <= 0 || interestCents < 0 || chargesCents < 0) {
    throw new InstallmentTermsError("The cash price and charges must be non-negative.");
  }

  const totalCents = cashCents + interestCents + chargesCents;
  let depositCents: number;
  if (input.depositMode === "PERCENTAGE") {
    if (input.depositValue <= 0 || input.depositValue >= 100) {
      throw new InstallmentTermsError("Percentage deposit must be between 0 and 100.");
    }
    depositCents = Math.floor((totalCents * input.depositValue) / 100);
  } else {
    depositCents = toCents(input.depositValue);
  }
  if (depositCents < 0 || depositCents >= totalCents) {
    throw new InstallmentTermsError("Deposit must be less than the total payable amount.");
  }

  const count = input.installmentCount;
  if (!Number.isInteger(count) || count < 1 || count > 60) {
    throw new InstallmentTermsError("Installment count must be between 1 and 60.");
  }

  const outstandingCents = totalCents - depositCents;
  const base = Math.floor(outstandingCents / count);
  const remainder = outstandingCents - base * count;
  const schedule = Array.from({ length: count }, (_, index) => ({
    sequence: index + 1,
    dueDate: addInterval(input.firstDueDate, input.frequency, index + 1),
    amount: toMajor(base + (index === count - 1 ? remainder : 0)),
  }));

  return {
    depositAmount: toMajor(depositCents),
    totalPayable: toMajor(totalCents),
    outstandingBalance: toMajor(outstandingCents),
    installmentAmount: toMajor(base),
    schedule,
  };
}

/** Schedules must never exceed the agreed outstanding balance. */
export function scheduleTotal(schedule: ScheduleEntry[]): number {
  return toMajor(schedule.reduce((sum, entry) => sum + toCents(entry.amount), 0));
}
