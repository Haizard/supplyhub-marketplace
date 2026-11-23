import "server-only";

import { redirect } from "next/navigation";

import { requireActor } from "@/server/auth/guards";

import { requireBusinessAccess, type BusinessAccess } from "./access";

export interface BuyerContext extends BusinessAccess {
  businessName: string;
}

/**
 * Resolves the active business for buyer-side B2B pages. The business id comes
 * from the authenticated session, never from a query string or form field.
 */
export async function requireBuyerContext(
  nextPath: string,
  permission = "wholesale.read",
): Promise<BuyerContext> {
  const actor = await requireActor(nextPath);
  const businessId = actor.business?.id;

  if (!businessId) {
    redirect("/business?required=b2b");
  }

  const access = await requireBusinessAccess(businessId, permission, nextPath);
  return {
    ...access,
    businessName: actor.business?.name ?? "",
  };
}
