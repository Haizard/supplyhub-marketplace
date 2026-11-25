import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { hashRequestBody } from "@/features/logistics-api/service";
import { readBearer, verifyWebhookSignature } from "@/server/logistics/api-auth";
import { apiDeliveryRequestSchema, externalOrderSchema } from "@/features/logistics-api/validation";

describe("Phase 9 L10 — API key parsing", () => {
  it("accepts a well-formed bearer key and rejects malformed or injected values", () => {
    const key = readBearer("Bearer lsk_abc123.superSecretValue123456");
    expect(key?.keyId).toBe("lsk_abc123");
    expect(key?.secret).toBe("superSecretValue123456");
    expect(readBearer("Bearer basic-token")).toBeNull();
    expect(readBearer("Bearer lsk_a b.secret")).toBeNull();
  });
});

describe("Phase 9 L10 — webhook signatures", () => {
  const secret = "whsec_test-secret";
  const body = JSON.stringify({ externalOrderId: "ORD-1" });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = `sha256=${createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex")}`;

  it("verifies a correctly signed payload", () => {
    expect(verifyWebhookSignature(secret, body, signature, String(timestamp))).toBe(true);
  });

  it("rejects tampering, stale timestamps and missing headers", () => {
    expect(verifyWebhookSignature(secret, `${body} `, signature, String(timestamp))).toBe(false);
    expect(verifyWebhookSignature(secret, body, signature, String(timestamp - 600))).toBe(false);
    expect(verifyWebhookSignature(secret, body, null, String(timestamp))).toBe(false);
  });
});

describe("Phase 9 L10 — request validation and idempotency", () => {
  const request = {
    externalRef: "SHOPIFY-1001",
    pickupName: "Shop",
    pickupAddress: "123 Main St",
    pickup: { latitude: -6.8, longitude: 39.2 },
    dropoffName: "Customer",
    dropoffAddress: "45 Beach Rd",
    dropoff: { latitude: -6.75, longitude: 39.25 },
    currency: "TZS",
  };

  it("validates a complete request and produces a stable hash", () => {
    const parsed = apiDeliveryRequestSchema.safeParse(request);
    expect(parsed.success).toBe(true);
    expect(hashRequestBody(parsed.data)).toBe(hashRequestBody(parsed.data));
  });

  it("rejects a mismatched currency code", () => {
    expect(apiDeliveryRequestSchema.safeParse({ ...request, currency: "tzs" }).success).toBe(false);
  });

  it("validates external store order payloads", () => {
    expect(
      externalOrderSchema.safeParse({
        externalOrderId: "ORD-1",
        customerName: "Amina",
        pickupName: "Shop",
        pickupAddress: "123 Main St",
        pickupLatitude: -6.8,
        pickupLongitude: 39.2,
        dropoffName: "Customer",
        dropoffAddress: "45 Beach Rd",
        dropoffLatitude: -6.75,
        dropoffLongitude: 39.25,
        currency: "TZS",
        fee: 5000,
        distanceKm: 3.2,
      }).success,
    ).toBe(true);
  });
});
