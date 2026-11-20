import { describe, expect, it } from "vitest";

import { shipmentSchema } from "@/features/shipments/validation";

describe("shipment details", () => {
  it("requires a carrier and a tracking number", () => {
    const missing = shipmentSchema.safeParse({ carrier: " ", trackingNumber: "" });
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.error.issues.map((issue) => issue.path[0])).toEqual([
        "carrier",
        "trackingNumber",
      ]);
    }
  });

  it("trims values and keeps the tracking link optional", () => {
    const parsed = shipmentSchema.parse({
      carrier: "  Sendy ",
      trackingNumber: " SND-4491 ",
      trackingUrl: "   ",
    });

    expect(parsed).toEqual({
      carrier: "Sendy",
      trackingNumber: "SND-4491",
      trackingUrl: undefined,
    });
  });

  it("rejects a tracking link that is not a full URL", () => {
    const parsed = shipmentSchema.safeParse({
      carrier: "DHL",
      trackingNumber: "123",
      trackingUrl: "track.example/123",
    });

    expect(parsed.success).toBe(false);
  });
});
