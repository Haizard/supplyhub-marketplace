import { describe, expect, it } from "vitest";

import { hasPermission } from "@/server/business/permissions";
import { canTransitionCompany } from "@/features/logistics-companies/status";
import { LOGISTICS_PERMISSION_KEYS, roleSchema } from "@/features/logistics-companies/validation";

const companyId = "00000000-0000-4000-8000-000000000001";

describe("Phase 9 L1 — company lifecycle", () => {
  it("allows submission decisions but blocks reapplication from rejected", () => {
    expect(canTransitionCompany("PENDING", "APPROVED")).toBe(true);
    expect(canTransitionCompany("PENDING", "REJECTED")).toBe(true);
    expect(canTransitionCompany("APPROVED", "SUSPENDED")).toBe(true);
    expect(canTransitionCompany("SUSPENDED", "APPROVED")).toBe(true);
    expect(canTransitionCompany("REJECTED", "PENDING")).toBe(false);
  });
});

describe("Phase 9 L1 — permission handling", () => {
  it("reuses the business permission helper for logistics contexts", () => {
    const context = {
      actorId: "user-1",
      companyId,
      memberId: "member-1",
      permissions: new Set(["logistics.company.read"]),
      isOwner: false,
      companyStatus: "APPROVED",
    };
    expect(hasPermission(context, "logistics.company.read")).toBe(true);
    expect(hasPermission(context, "logistics.finance.approve")).toBe(false);
    expect(hasPermission({ permissions: new Set(["*"]) }, "logistics.referral.manage")).toBe(true);
  });

  it("only accepts logistics permission keys in custom roles", () => {
    const base = {
      companyId,
      name: "Dispatcher",
      permissionKeys: ["logistics.dispatch.manage"],
    };
    expect(roleSchema.safeParse(base).success).toBe(true);
    expect(roleSchema.safeParse({ ...base, permissionKeys: ["admin.users.manage"] }).success).toBe(
      false,
    );
    expect(roleSchema.safeParse({ ...base, name: "owner" }).success).toBe(true);
    expect(LOGISTICS_PERMISSION_KEYS).toContain("logistics.finance.approve");
  });
});
