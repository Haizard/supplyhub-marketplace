import { describe, expect, it } from "vitest";

import {
  selectActiveBusiness,
  studioIdentityFor,
  type BusinessMembershipOption,
} from "@/server/business/active-business";

function membership(
  overrides: Partial<BusinessMembershipOption> & Pick<BusinessMembershipOption, "businessId">,
): BusinessMembershipOption {
  return {
    businessName: `Business ${overrides.businessId}`,
    memberId: `member-${overrides.businessId}`,
    status: "active",
    isOwner: false,
    vendorId: `vendor-${overrides.businessId}`,
    vendorStatus: "APPROVED",
    ...overrides,
  };
}

describe("active business selection", () => {
  it("defaults to the first active membership when the member owns only one business", () => {
    const atelier = membership({ businessId: "atelier", isOwner: true });

    expect(selectActiveBusiness([atelier], null)).toEqual(atelier);
  });

  it("lets a staff member select the business they were invited to", () => {
    const fieldAndForm = membership({
      businessId: "field-and-form",
      memberId: "member-field",
    });

    expect(selectActiveBusiness([fieldAndForm], null)?.businessId).toBe("field-and-form");
  });

  it("prefers a business the member owns over an earlier staff invitation", () => {
    const invitedFirst = membership({ businessId: "kigoma", status: "active" });
    const ownedLater = membership({ businessId: "atelier", isOwner: true });

    const active = selectActiveBusiness([invitedFirst, ownedLater], null);

    expect(active?.businessId).toBe("atelier");
    expect(active?.isOwner).toBe(true);
  });

  it("still honours an explicit switch to a business the member only staffs", () => {
    const invited = membership({ businessId: "kigoma" });
    const owned = membership({ businessId: "atelier", isOwner: true });

    expect(selectActiveBusiness([invited, owned], "kigoma")?.businessId).toBe("kigoma");
  });

  it("honours a preferred business that is still an active membership", () => {
    const first = membership({ businessId: "atelier", isOwner: true });
    const second = membership({ businessId: "loom-house" });

    const active = selectActiveBusiness([first, second], "loom-house");

    expect(active?.businessId).toBe("loom-house");
    expect(active?.isOwner).toBe(false);
  });

  it("ignores a preferred business the member does not actively belong to", () => {
    const owned = membership({ businessId: "atelier", isOwner: true });
    const removed = membership({ businessId: "someone-elses", status: "removed" });

    expect(selectActiveBusiness([owned, removed], "someone-elses")?.businessId).toBe("atelier");
  });

  it("never activates a suspended membership", () => {
    const suspended = membership({ businessId: "atelier", status: "suspended" });

    expect(selectActiveBusiness([suspended], "atelier")).toBeNull();
  });

  it("returns null when the member belongs to no business", () => {
    expect(selectActiveBusiness([], "atelier")).toBeNull();
  });
});

describe("studio identity", () => {
  it("opens the active business's studio for an owner", () => {
    const identity = studioIdentityFor({
      business: { id: "atelier", vendorId: "vendor-atelier", vendorStatus: "APPROVED" },
      vendor: { id: "vendor-atelier", status: "APPROVED" },
    });

    expect(identity).toEqual({
      businessId: "atelier",
      vendorId: "vendor-atelier",
      source: "business",
    });
  });

  it("opens the same business's studio for a staff member", () => {
    const identity = studioIdentityFor({
      business: { id: "atelier", vendorId: "vendor-atelier", vendorStatus: "APPROVED" },
      vendor: null,
    });

    expect(identity).toEqual({
      businessId: "atelier",
      vendorId: "vendor-atelier",
      source: "business",
    });
  });

  it("never falls back to the actor's own vendor while a business is active", () => {
    const identity = studioIdentityFor({
      business: { id: "loom-house", vendorId: "vendor-loom", vendorStatus: "PENDING" },
      vendor: { id: "vendor-atelier", status: "APPROVED" },
    });

    expect(identity).toBeNull();
  });

  it("keeps an unlinked legacy vendor working as the owner of their studio", () => {
    const identity = studioIdentityFor({
      business: null,
      vendor: { id: "vendor-legacy", status: "APPROVED" },
    });

    expect(identity).toEqual({
      businessId: null,
      vendorId: "vendor-legacy",
      source: "legacy-owner",
    });
  });

  it("denies a customer with no membership and no vendor", () => {
    expect(studioIdentityFor({ business: null, vendor: null })).toBeNull();
  });

  it("denies a membership whose business has no approved vendor", () => {
    expect(
      studioIdentityFor({
        business: { id: "pending", vendorId: "vendor-pending", vendorStatus: "PENDING" },
        vendor: null,
      }),
    ).toBeNull();
  });
});
