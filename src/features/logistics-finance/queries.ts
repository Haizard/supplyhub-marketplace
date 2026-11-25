import "server-only";

import type {
  DriverEarningStatus,
  DriverPayoutStatus,
  LogisticsSettlementStatus,
} from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";

export interface EarningView {
  id: string;
  membershipId: string;
  driverName: string;
  jobId: string | null;
  basis: string;
  amount: string;
  currency: string;
  status: DriverEarningStatus;
  createdAt: string;
}

export interface PayoutView {
  id: string;
  payoutNumber: string;
  membershipId: string;
  driverName: string;
  amount: string;
  currency: string;
  status: DriverPayoutStatus;
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
}

export interface ExpenseView {
  id: string;
  category: string;
  amount: string;
  currency: string;
  occurredAt: string;
  reference: string;
  note: string;
}

export interface SettlementView {
  id: string;
  settlementNumber: string;
  status: LogisticsSettlementStatus;
  revenue: string;
  platformFees: string;
  driverCosts: string;
  expenses: string;
  net: string;
  periodStart: string;
  periodEnd: string;
}

export async function listEarnings(companyId: string): Promise<EarningView[]> {
  const rows = await getDatabase().driverEarning.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      membershipId: true,
      jobId: true,
      basis: true,
      amount: true,
      currency: true,
      status: true,
      createdAt: true,
      membership: { select: { driver: { select: { fullName: true } } } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    membershipId: row.membershipId,
    driverName: row.membership.driver.fullName,
    jobId: row.jobId,
    basis: row.basis,
    amount: row.amount.toString(),
    currency: row.currency,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listPayouts(companyId: string): Promise<PayoutView[]> {
  const rows = await getDatabase().driverPayout.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      payoutNumber: true,
      membershipId: true,
      amount: true,
      currency: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      paidAt: true,
      membership: { select: { driver: { select: { fullName: true } } } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    payoutNumber: row.payoutNumber,
    membershipId: row.membershipId,
    driverName: row.membership.driver.fullName,
    amount: row.amount.toString(),
    currency: row.currency,
    status: row.status,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
  }));
}

export async function listExpenses(companyId: string): Promise<ExpenseView[]> {
  const rows = await getDatabase().logisticsExpense.findMany({
    where: { companyId },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });
  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    amount: row.amount.toString(),
    currency: row.currency,
    occurredAt: row.occurredAt.toISOString(),
    reference: row.reference ?? "",
    note: row.note ?? "",
  }));
}

export async function listSettlements(companyId: string): Promise<SettlementView[]> {
  const rows = await getDatabase().logisticsSettlement.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return rows.map((row) => ({
    id: row.id,
    settlementNumber: row.settlementNumber,
    status: row.status,
    revenue: row.revenue.toString(),
    platformFees: row.platformFees.toString(),
    driverCosts: row.driverCosts.toString(),
    expenses: row.expenses.toString(),
    net: row.net.toString(),
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
  }));
}

export async function listDriverMembershipsForFinance(companyId: string) {
  const rows = await getDatabase().driverCompanyMembership.findMany({
    where: { companyId, status: "ACTIVE" },
    select: {
      id: true,
      driver: { select: { fullName: true } },
      compensationRules: {
        select: {
          mode: true,
          fixedAmount: true,
          perDelivery: true,
          rateBps: true,
          dailyAmount: true,
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.driver.fullName,
    compensation: row.compensationRules[0]
      ? {
          mode: row.compensationRules[0].mode,
          fixedAmount: row.compensationRules[0].fixedAmount?.toString() ?? null,
          perDelivery: row.compensationRules[0].perDelivery?.toString() ?? null,
          rateBps: row.compensationRules[0].rateBps,
          dailyAmount: row.compensationRules[0].dailyAmount?.toString() ?? null,
        }
      : null,
  }));
}

export async function listVehiclesForFinance(companyId: string) {
  const rows = await getDatabase().logisticsVehicle.findMany({
    where: { companyId, status: { not: "RETIRED" } },
    orderBy: { plate: "asc" },
    select: { id: true, plate: true },
  });
  return rows.map((row) => ({ id: row.id, plate: row.plate }));
}
