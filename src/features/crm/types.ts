import type { CustomerSegment } from "@/generated/prisma/enums";

export interface StudioCustomerView {
  userId: string;
  recordId: string | null;
  name: string;
  email: string;
  segment: CustomerSegment;
  note: string;
  orderCount: number;
  paidOrderCount: number;
  totalSpend: number;
  lastOrderAt: string | null;
}
