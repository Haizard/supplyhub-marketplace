import { Prisma } from "@/generated/prisma/client";
import type { DriverCompensationMode } from "@/generated/prisma/enums";

const money = (value: string | number | null | undefined): Prisma.Decimal => {
  if (value === null || value === undefined || value === "") return new Prisma.Decimal(0);
  return new Prisma.Decimal(value);
};

export interface CompensationRule {
  mode: DriverCompensationMode;
  fixedAmount: string | number | null;
  perDelivery: string | number | null;
  rateBps: number | null;
  dailyAmount: string | number | null;
}

/** Compensation is computed from stored, configurable terms; no hardcoded percentages. */
export function calculateDriverEarning(
  rule: CompensationRule,
  context: { deliveryFee: string | number; deliveries: number; days: number },
): string {
  let amount = new Prisma.Decimal(0);
  switch (rule.mode) {
    case "FIXED_MONTHLY":
      amount = money(rule.fixedAmount);
      break;
    case "PER_DELIVERY":
      amount = money(rule.perDelivery).times(context.deliveries);
      break;
    case "PERCENTAGE":
      amount = money(context.deliveryFee)
        .times(new Prisma.Decimal(rule.rateBps ?? 0))
        .div(10_000);
      break;
    case "DAILY":
      amount = money(rule.dailyAmount).times(context.days);
      break;
    case "HYBRID":
      amount = money(rule.fixedAmount)
        .plus(money(rule.perDelivery).times(context.deliveries))
        .plus(
          money(context.deliveryFee)
            .times(new Prisma.Decimal(rule.rateBps ?? 0))
            .div(10_000),
        );
      break;
  }
  return amount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
}

export interface SettlementTotals {
  revenue: string | number;
  platformFees: string | number;
  driverCosts: string | number;
  expenses: string | number;
}

export function calculateSettlementNet(totals: SettlementTotals): string {
  const net = money(totals.revenue)
    .minus(money(totals.platformFees))
    .minus(money(totals.driverCosts))
    .minus(money(totals.expenses));
  return net.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
}

/** A payout cannot exceed approved, unpaid earnings for the driver and period. */
export function payoutEligibility(
  earnings: readonly { amount: string | number; status: string }[],
  existingPaid: string | number,
  requested: string | number,
): { eligible: boolean; available: string } {
  const approved = earnings
    .filter((earning) => earning.status === "APPROVED")
    .reduce((sum, earning) => sum.plus(money(earning.amount)), new Prisma.Decimal(0));
  const available = approved.minus(money(existingPaid));
  return {
    eligible: available.greaterThanOrEqualTo(money(requested)) && available.greaterThan(0),
    available: available.toFixed(2),
  };
}
