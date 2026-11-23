import { describe, expect, it } from "vitest";

import {
  branchSchema,
  companyUpdateSchema,
  settingsSchema,
} from "@/features/logistics-companies/validation";

const companyId = "00000000-0000-4000-8000-000000000001";

describe("Phase 9 L2 — branch validation", () => {
  const base = {
    companyId,
    name: "Dar es Salaam hub",
    branchCode: "DAR-01",
    isPrimary: "on",
    isActive: "on",
  };

  it("accepts a valid branch and normalizes checkboxes", () => {
    const parsed = branchSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.isPrimary).toBe(true);
      expect(parsed.data.isActive).toBe(true);
    }
  });

  it("defaults an unchecked primary flag to false", () => {
    const parsed = branchSchema.safeParse({ ...base, isPrimary: "off" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.isPrimary).toBe(false);
  });

  it("rejects lowercase branch codes", () => {
    expect(branchSchema.safeParse({ ...base, branchCode: "dar-01" }).success).toBe(false);
  });
});

describe("Phase 9 L2 — settings validation", () => {
  const base = {
    companyId,
    currency: "TZS",
    timezone: "Africa/Dar_es_Salaam",
    defaultServiceRadius: "15",
  };

  it("accepts documented defaults", () => {
    expect(settingsSchema.safeParse(base).success).toBe(true);
  });

  it("rejects lowercase currency and negative radius", () => {
    expect(settingsSchema.safeParse({ ...base, currency: "tzs" }).success).toBe(false);
    expect(settingsSchema.safeParse({ ...base, defaultServiceRadius: "-1" }).success).toBe(false);
  });
});

describe("Phase 9 L2 — profile validation", () => {
  it("requires the company id from the server context", () => {
    const profile = {
      name: "Arusha Express",
      slug: "arusha-express",
      countryCode: "TZ",
    };
    expect(companyUpdateSchema.safeParse(profile).success).toBe(false);
    expect(companyUpdateSchema.safeParse({ ...profile, companyId }).success).toBe(true);
  });
});
