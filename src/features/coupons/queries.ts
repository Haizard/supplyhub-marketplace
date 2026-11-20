import "server-only";

import { getDatabase } from "@/server/db/client";

export interface AdminCoupon {
  id: string;
  code: string;
  description: string;
  kind: "PERCENT" | "FIXED";
  value: string;
  currency: string;
  minSubtotal: string | null;
  maxRedemptions: number | null;
  redemptions: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
}

export async function listCoupons(): Promise<AdminCoupon[]> {
  const database = getDatabase();

  const coupons = await database.coupon.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      code: true,
      description: true,
      kind: true,
      value: true,
      currency: true,
      minSubtotal: true,
      maxRedemptions: true,
      redemptions: true,
      startsAt: true,
      endsAt: true,
      isActive: true,
    },
  });

  return coupons.map((coupon) => ({
    ...coupon,
    value: coupon.value.toString(),
    minSubtotal: coupon.minSubtotal === null ? null : coupon.minSubtotal.toString(),
  }));
}
