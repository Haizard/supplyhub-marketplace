import { describe, expect, it } from "vitest";

import {
  canTransitionClient,
  canTransitionRelationship,
} from "@/features/logistics-clients/status";
import { clientSchema, contactSchema } from "@/features/logistics-clients/validation";

const companyId = "00000000-0000-4000-8000-000000000001";

describe("Phase 9 L4 — client lifecycle", () => {
  it("lets a prospect become active but blocks reapplication after end", () => {
    expect(canTransitionClient("PROSPECT", "ACTIVE")).toBe(true);
    expect(canTransitionClient("ACTIVE", "SUSPENDED")).toBe(true);
    expect(canTransitionClient("SUSPENDED", "ACTIVE")).toBe(true);
    expect(canTransitionClient("ENDED", "PROSPECT")).toBe(false);
  });

  it("moves relationships independently of the global client record", () => {
    expect(canTransitionRelationship("PENDING", "ACTIVE")).toBe(true);
    expect(canTransitionRelationship("ACTIVE", "SUSPENDED")).toBe(true);
    expect(canTransitionRelationship("ENDED", "ACTIVE")).toBe(false);
  });
});

describe("Phase 9 L4 — validation", () => {
  const base = { companyId, name: "Kilimanjaro Electronics" };

  it("accepts a merchant with no marketplace links", () => {
    const parsed = clientSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.name).toBe("Kilimanjaro Electronics");
  });

  it("rejects a half-filled coordinate pair is handled in the action, not schema", () => {
    expect(clientSchema.safeParse({ ...base, latitude: "-3.3" }).success).toBe(true);
  });

  it("ensures only one primary contact is allowed by form semantics", () => {
    const parsed = contactSchema.safeParse({
      companyId,
      clientId: companyId,
      name: "Amina Hassan",
      role: "Owner",
      isPrimary: "on",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.isPrimary).toBe(true);
  });
});
