import "server-only";

import { redirect } from "next/navigation";

import type { Actor } from "@/server/auth/actor";
import { getSessionActor } from "@/server/auth/session";

import { studioIdentityFor } from "./active-business";
import { BusinessAccessError, resolveBusinessContext } from "./context";
import { hasPermission } from "./permissions";

export interface StudioAccess {
  actor: Actor;
  vendorId: string;
  businessId: string | null;
  memberId: string | null;
  isOwner: boolean;
  permissions: ReadonlySet<string>;
}

/**
 * Authorizes access to the seller studio and resolves the single vendor whose
 * data the request may touch.
 *
 * The active business decides the vendor, never the client: a staff member of a
 * business opens that business's studio and needs the requested permission,
 * while an unlinked legacy vendor keeps the original 1:1 behaviour.
 */
export async function requireStudioAccess(
  permission: string,
  nextPath = "/vendor",
): Promise<StudioAccess> {
  const actor = await getSessionActor();

  if (!actor) {
    redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  }

  if (actor.role === "ADMIN") {
    redirect("/admin/products");
  }

  const identity = studioIdentityFor({
    business: actor.business ?? null,
    vendor: actor.vendor,
  });

  if (!identity) {
    redirect("/vendor");
  }

  if (identity.source === "legacy-owner") {
    // Legacy studio with no business link: the owner keeps full access.
    return {
      actor,
      vendorId: identity.vendorId,
      businessId: null,
      memberId: null,
      isOwner: true,
      permissions: new Set(["*"]),
    };
  }

  const businessId = identity.businessId;
  if (!businessId) {
    redirect("/vendor");
  }

  const context = await resolveBusinessContext(actor, businessId).catch((error: unknown) => {
    if (error instanceof BusinessAccessError) redirect("/vendor");
    throw error;
  });

  if (!hasPermission(context, permission)) {
    redirect("/account?denied=studio");
  }

  return {
    actor,
    vendorId: identity.vendorId,
    businessId,
    memberId: context.memberId,
    isOwner: context.isOwner,
    permissions: context.permissions,
  };
}
