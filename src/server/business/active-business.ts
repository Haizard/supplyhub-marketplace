/**
 * Pure business-context selection rules.
 *
 * Kept free of database imports so the "which business is active" and "which
 * studio does this actor open" decisions can be unit tested directly.
 */

import type { VendorStatus } from "@/generated/prisma/enums";

/** First-party cookie holding the business a member last switched to. */
export const ACTIVE_BUSINESS_COOKIE = "supplyhub_business";

export interface BusinessMembershipOption {
  businessId: string;
  businessName: string;
  memberId: string;
  status: string;
  isOwner: boolean;
  vendorId: string | null;
  vendorStatus: VendorStatus | null;
}

/**
 * Picks the business a member is acting as.
 *
 * The preferred (cookie) selection wins only when it is still an *active*
 * membership of that user, so a stale or forged cookie can never grant access
 * to someone else's business. Otherwise a business the member owns is preferred
 * over one they were invited to, and the earliest active membership is last.
 */
export function selectActiveBusiness(
  options: readonly BusinessMembershipOption[],
  preferredBusinessId?: string | null,
): BusinessMembershipOption | null {
  const active = options.filter((option) => option.status === "active");

  if (active.length === 0) {
    return null;
  }

  if (preferredBusinessId) {
    const match = active.find((option) => option.businessId === preferredBusinessId);
    if (match) {
      return match;
    }
  }

  return active.find((option) => option.isOwner) ?? active[0] ?? null;
}

export interface StudioIdentityInput {
  business?: { id: string; vendorId: string | null; vendorStatus: VendorStatus | null } | null;
  vendor: { id: string; status: VendorStatus } | null;
}

export interface StudioIdentity {
  businessId: string | null;
  vendorId: string;
  source: "business" | "legacy-owner";
}

/**
 * Decides which vendor's studio an actor opens.
 *
 * A business membership always wins over the legacy 1:1 user → vendor link, so
 * staff act on the business they belong to. A membership whose business has no
 * approved vendor resolves to null (the studio shows the application state)
 * rather than silently falling back to another studio.
 */
export function studioIdentityFor(input: StudioIdentityInput): StudioIdentity | null {
  const business = input.business ?? null;

  if (business) {
    if (!business.vendorId || business.vendorStatus !== "APPROVED") {
      return null;
    }

    return { businessId: business.id, vendorId: business.vendorId, source: "business" };
  }

  if (input.vendor?.status === "APPROVED") {
    return { businessId: null, vendorId: input.vendor.id, source: "legacy-owner" };
  }

  return null;
}
