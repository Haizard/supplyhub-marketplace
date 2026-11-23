import "server-only";

import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { recordAuditEvent } from "@/server/audit/audit-log";

import {
  pointsForOrderTotal,
  REDEMPTION_CURRENCY,
  REDEMPTION_POINT_COST,
  REDEMPTION_VALUE,
  tierForLifetimePoints,
} from "./points";

export async function ensureLoyaltyAccount(
  client: Prisma.TransactionClient,
  userId: string,
): Promise<{ id: string; pointsBalance: number; lifetimePoints: number }> {
  const existing = await client.loyaltyAccount.findUnique({
    where: { userId },
    select: { id: true, pointsBalance: true, lifetimePoints: true },
  });
  if (existing) return existing;

  const created = await client.loyaltyAccount.create({
    data: { userId },
    select: { id: true, pointsBalance: true, lifetimePoints: true },
  });

  await recordAuditEvent(client, {
    actorId: userId,
    action: "LOYALTY_ACCOUNT_CREATED",
    targetType: "loyalty_account",
    targetId: created.id,
  });

  return created;
}

/** Awards points once when an order reaches delivered, keyed by order id. */
export async function awardOrderPoints(
  client: Prisma.TransactionClient,
  input: {
    orderId: string;
    customerId: string;
    total: { toString(): string } | number | string;
    actorId?: string;
  },
): Promise<number> {
  const alreadyAwarded = await client.loyaltyTransaction.findFirst({
    where: {
      referenceType: "order",
      referenceId: input.orderId,
      type: "EARNED_PURCHASE",
    },
    select: { id: true },
  });
  if (alreadyAwarded) return 0;

  const points = pointsForOrderTotal(input.total);
  if (points === 0) return 0;

  const account = await ensureLoyaltyAccount(client, input.customerId);
  const balanceAfter = account.pointsBalance + points;
  const lifetimePoints = account.lifetimePoints + points;

  await client.loyaltyAccount.update({
    where: { id: account.id },
    data: {
      pointsBalance: balanceAfter,
      lifetimePoints,
      tier: tierForLifetimePoints(lifetimePoints),
    },
  });

  const transaction = await client.loyaltyTransaction.create({
    data: {
      accountId: account.id,
      type: "EARNED_PURCHASE",
      points,
      balanceAfter,
      referenceType: "order",
      referenceId: input.orderId,
      description: "Points earned from a delivered order.",
    },
    select: { id: true },
  });

  await recordAuditEvent(client, {
    actorId: input.actorId ?? input.customerId,
    action: "LOYALTY_POINTS_EARNED",
    targetType: "loyalty_transaction",
    targetId: transaction.id,
    metadata: { orderId: input.orderId, points, balanceAfter },
  });

  return points;
}

/** Redeems points for a single-use checkout coupon. */
export async function redeemLoyaltyReward(
  client: Prisma.TransactionClient,
  userId: string,
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const account = await ensureLoyaltyAccount(client, userId);
  if (account.pointsBalance < REDEMPTION_POINT_COST) {
    return { ok: false, error: "You need more points to redeem this reward." };
  }

  const code = `LOYAL-${randomUUID().slice(0, 10).toUpperCase()}`;
  const coupon = await client.coupon.create({
    data: {
      code,
      description: `${REDEMPTION_VALUE.toLocaleString("en-US")} ${REDEMPTION_CURRENCY} loyalty reward`,
      kind: "FIXED",
      value: REDEMPTION_VALUE.toFixed(2),
      currency: REDEMPTION_CURRENCY,
      maxRedemptions: 1,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
    },
    select: { id: true },
  });

  const balanceAfter = account.pointsBalance - REDEMPTION_POINT_COST;
  await client.loyaltyAccount.update({
    where: { id: account.id },
    data: { pointsBalance: balanceAfter },
  });

  const transaction = await client.loyaltyTransaction.create({
    data: {
      accountId: account.id,
      type: "REDEEMED_REWARD",
      points: -REDEMPTION_POINT_COST,
      balanceAfter,
      referenceType: "coupon",
      referenceId: coupon.id,
      description: `Redeemed for coupon ${code}.`,
    },
    select: { id: true },
  });

  await recordAuditEvent(client, {
    actorId: userId,
    action: "LOYALTY_POINTS_REDEEMED",
    targetType: "loyalty_transaction",
    targetId: transaction.id,
    metadata: { couponId: coupon.id, points: REDEMPTION_POINT_COST, balanceAfter },
  });

  return { ok: true, code };
}
