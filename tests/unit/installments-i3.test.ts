import { describe, expect, it } from "vitest";

import {
  formatReceiptAmount,
  isInstallmentOverdue,
  shouldQueueUpcoming,
  upcomingReminderDate,
} from "@/features/installments/overdue-rules";
import { buildReceiptText } from "@/features/installments/receipt-service";

const now = new Date("2026-11-25T00:00:00.000Z");
const due = new Date("2026-11-20T00:00:00.000Z");

describe("Phase 10 I3 — overdue and reminder rules", () => {
  it("respects the seller-configured grace period", () => {
    expect(isInstallmentOverdue(due, 0, now)).toBe(true);
    expect(isInstallmentOverdue(due, 3, now)).toBe(true);
    expect(isInstallmentOverdue(due, 7, now)).toBe(false);
    expect(isInstallmentOverdue(new Date("2026-12-01T00:00:00.000Z"), 0, now)).toBe(false);
  });

  it("queues upcoming reminders only inside the lookahead window", () => {
    const upcoming = new Date("2026-11-27T00:00:00.000Z");
    expect(upcomingReminderDate(upcoming, 3).toISOString()).toBe("2026-11-24T00:00:00.000Z");
    expect(shouldQueueUpcoming(upcoming, 3, now)).toBe(true);
    expect(shouldQueueUpcoming(new Date("2026-12-10T00:00:00.000Z"), 3, now)).toBe(false);
    expect(shouldQueueUpcoming(due, 3, now)).toBe(false);
  });

  it("formats receipt amounts without inventing currency policy", () => {
    expect(formatReceiptAmount("150000.00", "TZS")).toBe("150,000.00 TZS");
  });

  it("builds a receipt from frozen agreement data only", () => {
    const text = buildReceiptText({
      receiptNumber: "IR-1",
      agreementNumber: "IA-1",
      amount: "300000.00",
      currency: "TZS",
      method: "MPESA",
      paidAt: "2026-11-24T10:00:00.000Z",
      sellerName: "Example Shop",
      buyerEmail: "buyer@example.com",
    });
    expect(text).toContain("IR-1");
    expect(text).toContain("300,000.00 TZS");
    expect(text).toContain("Example Shop");
    expect(text).not.toContain("api-key");
  });
});
