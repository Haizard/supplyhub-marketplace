import { describe, expect, it } from "vitest";

import {
  BusinessAccessError,
  hasPermission,
  requirePermission,
  type BusinessContext,
} from "@/server/business/permissions";

function context(permissions: string[], isOwner = false): BusinessContext {
  return {
    businessId: "business-a",
    memberId: "member-a",
    permissions: new Set(permissions),
    isOwner,
  };
}

describe("business permissions", () => {
  it("grants only the permissions the member's roles include", () => {
    const member = context(["business.read", "orders.read"]);

    expect(hasPermission(member, "business.read")).toBe(true);
    expect(hasPermission(member, "business.update")).toBe(false);
    expect(hasPermission(member, "business.members.manage")).toBe(false);
  });

  it("treats the admin wildcard as every permission", () => {
    const admin = context(["*"]);

    expect(hasPermission(admin, "business.update")).toBe(true);
    expect(hasPermission(admin, "finance.expense.create")).toBe(true);
  });

  it("throws a forbidden access error when a permission is missing", () => {
    let thrown: unknown;

    try {
      requirePermission(context(["business.read"]), "business.update");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(BusinessAccessError);
    expect((thrown as BusinessAccessError).code).toBe("forbidden");
  });

  it("does not treat ownership as permission bypass without the permission key", () => {
    const owner = context(["business.read"], true);

    expect(hasPermission(owner, "business.update")).toBe(false);
  });

  it("resolves both an owner permission and a staff permission independently", () => {
    const staff = context([
      "business.read",
      "orders.read",
      "orders.fulfill",
      "catalog.product.publish",
    ]);

    expect(hasPermission(staff, "orders.fulfill")).toBe(true);
    expect(hasPermission(staff, "finance.read")).toBe(false);
  });
});
