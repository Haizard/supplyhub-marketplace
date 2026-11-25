import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  planPaymentAllocation,
  planRefund,
  toMajor,
  toMinor,
  type AllocationScheduleEntry,
} from "@/features/installments/payment-rules";
import {
  recordInstallmentCashSchema,
  refundInstallmentSchema,
  startInstallmentPaymentSchema,
} from "@/features/installments/validation";
import { verifyLynxPayWebhook } from "@/server/payments/lynxpay/webhook";

function schedule(): AllocationScheduleEntry[] {
  return [1, 2, 3].map((sequence) => ({
    id: `s-${sequence}`,
    sequence,
    amountMinor: 150_000_00,
    paidMinor: 0,
    status: "PENDING",
  }));
}

describe("Phase 10 I2 — payment allocation", () => {
  it("allocates a full payment across instalments in due order", () => {
    const plan = planPaymentAllocation(450_000_00, schedule(), false);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.allocations).toHaveLength(3);
    expect(plan.remainingMinor).toBe(0);
    expect(plan.updates.every((entry) => entry.status === "PAID")).toBe(true);
  });

  it("supports partial payments and partial instalment payments", () => {
    const entries = schedule();
    entries[0] = { ...entries[0]!, paidMinor: 50_000_00, status: "OVERDUE" };
    const plan = planPaymentAllocation(120_000_00, entries, false);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.allocations.map((entry) => entry.amountMinor)).toEqual([100_000_00, 20_000_00]);
    expect(plan.updates[0]?.status).toBe("PAID");
    expect(plan.updates[1]?.status).toBe("PENDING");
  });

  it("rejects overpayment unless advance payments are enabled", () => {
    expect(planPaymentAllocation(500_000_00, schedule(), false).ok).toBe(false);
    const allowed = planPaymentAllocation(500_000_00, schedule(), true);
    expect(allowed.ok).toBe(true);
    if (allowed.ok) expect(allowed.remainingMinor).toBe(50_000_00);
  });

  it("never allocates to PAID or WAIVED instalments", () => {
    const entries = schedule();
    entries[0] = { ...entries[0]!, status: "PAID", paidMinor: entries[0]!.amountMinor };
    const plan = planPaymentAllocation(150_000_00, entries, false);
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.allocations[0]?.scheduleId).toBe("s-2");
  });

  it("reverses refunds in reverse allocation order", () => {
    const refund = planRefund(120_000_00, [
      { scheduleId: "s-1", paidMinor: 100_000_00 },
      { scheduleId: "s-2", paidMinor: 50_000_00 },
    ]);
    expect(refund.reductions).toEqual([
      { scheduleId: "s-2", amountMinor: 50_000_00 },
      { scheduleId: "s-1", amountMinor: 70_000_00 },
    ]);
    expect(refund.remainingMinor).toBe(0);
  });

  it("round-trips minor units without floating point drift", () => {
    expect(toMinor(333.33)).toBe(33333);
    expect(toMajor(33333)).toBe(333.33);
  });
});

describe("Phase 10 I2 — provider callback trust boundary", () => {
  const secret = "webhook-secret";
  const body = JSON.stringify({
    id: "pay-1",
    external_id: "IP-1",
    amount: 15000000,
    status: "completed",
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

  it("verifies a correctly signed callback", () => {
    expect(verifyLynxPayWebhook({ rawBody: body, timestamp, signature, secret })).toBe(true);
  });

  it("rejects tampered bodies, stale timestamps and missing signatures", () => {
    expect(verifyLynxPayWebhook({ rawBody: `${body} `, timestamp, signature, secret })).toBe(false);
    expect(
      verifyLynxPayWebhook({
        rawBody: body,
        timestamp: String(Number(timestamp) - 600),
        signature,
        secret,
      }),
    ).toBe(false);
    expect(verifyLynxPayWebhook({ rawBody: body, timestamp, signature: null, secret })).toBe(false);
  });

  it("validates payment form input", () => {
    const agreementId = "11111111-1111-4111-8111-111111111111";
    expect(
      startInstallmentPaymentSchema.safeParse({
        agreementId,
        amount: "150000",
        method: "MPESA",
        phone: "",
      }).success,
    ).toBe(true);
    expect(
      startInstallmentPaymentSchema.safeParse({
        agreementId,
        amount: "0",
        method: "MPESA",
        phone: "",
      }).success,
    ).toBe(false);
    expect(
      recordInstallmentCashSchema.safeParse({
        businessId: agreementId,
        agreementId,
        amount: "150000",
        method: "CASH",
        note: "",
      }).success,
    ).toBe(true);
    expect(
      refundInstallmentSchema.safeParse({
        businessId: agreementId,
        paymentId: agreementId,
        reason: "duplicate transfer",
      }).success,
    ).toBe(true);
  });
});
