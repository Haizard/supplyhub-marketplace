import { describe, expect, it } from "vitest";

import {
  cashChangeCents,
  lineTotalCents,
  saleSubtotalCents,
  startOfDay,
} from "@/features/pos/calculation";

describe("lineTotalCents", () => {
  it("multiplies unit price by quantity", () => {
    expect(lineTotalCents(115_000, 3)).toBe(345_000);
  });

  it("rejects a zero or fractional quantity", () => {
    expect(lineTotalCents(115_000, 0)).toBeNull();
    expect(lineTotalCents(115_000, 1.5)).toBeNull();
  });

  it("rejects a negative or fractional price", () => {
    expect(lineTotalCents(-1, 2)).toBeNull();
    expect(lineTotalCents(12.5, 2)).toBeNull();
  });
});

describe("saleSubtotalCents", () => {
  it("adds every line without floating point drift", () => {
    expect(
      saleSubtotalCents([
        { unitPriceCents: 19_999, quantity: 3 },
        { unitPriceCents: 5_001, quantity: 2 },
      ]),
    ).toBe(69_999);
  });

  it("is zero for an empty cart", () => {
    expect(saleSubtotalCents([])).toBe(0);
  });

  it("returns null when any line is invalid", () => {
    expect(
      saleSubtotalCents([
        { unitPriceCents: 100, quantity: 1 },
        { unitPriceCents: 100, quantity: -1 },
      ]),
    ).toBeNull();
  });
});

describe("cashChangeCents", () => {
  it("returns the difference for an over-tender", () => {
    expect(cashChangeCents(34_500, 50_000)).toBe(15_500);
  });

  it("allows an exact tender", () => {
    expect(cashChangeCents(34_500, 34_500)).toBe(0);
  });

  it("refuses an under-tender", () => {
    expect(cashChangeCents(34_500, 30_000)).toBeNull();
  });
});

describe("startOfDay", () => {
  it("returns local midnight for the given moment", () => {
    const start = startOfDay(new Date("2026-11-17T14:35:09.500Z"));

    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
    expect(start.getDate()).toBe(new Date("2026-11-17T14:35:09.500Z").getDate());
  });
});
