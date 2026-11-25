import "server-only";

import type { Actor } from "@/server/auth/actor";
import { requireActor } from "@/server/auth/guards";
import {
  BusinessAccessError,
  hasPermission,
  resolveBusinessContext,
} from "@/server/business/context";

/** Seller-side authorization for installment mutations. Never trusts a client role. */
export async function authorizeInstallmentSeller(
  businessId: string,
  nextPath = `/business/${businessId}/installments`,
): Promise<{ actor: Actor } | { error: string }> {
  const actor = await requireActor(nextPath);
  try {
    const context = await resolveBusinessContext(actor, businessId);
    if (!hasPermission(context, "installments.manage")) {
      return { error: "Your business role does not include installment management." };
    }
    return { actor };
  } catch (error) {
    if (error instanceof BusinessAccessError) {
      return { error: "You cannot manage installments for this business." };
    }
    throw error;
  }
}
