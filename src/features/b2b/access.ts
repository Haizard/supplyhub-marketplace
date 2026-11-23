import "server-only";

import { redirect } from "next/navigation";

import { requireActor } from "@/server/auth/guards";
import { BusinessAccessError, resolveBusinessContext } from "@/server/business/context";
import { hasPermission } from "@/server/business/permissions";

export interface BusinessAccess {
  actorId: string;
  businessId: string;
  memberId: string;
  permissions: ReadonlySet<string>;
  isOwner: boolean;
}

/**
 * Authorizes a buyer-side business action. Business membership is resolved
 * from the session actor and the requested business id — never from a
 * client-supplied role or permission set.
 */
export async function requireBusinessAccess(
  businessId: string,
  permission: string,
  nextPath = "/b2b",
): Promise<BusinessAccess> {
  const actor = await requireActor(nextPath);
  try {
    const context = await resolveBusinessContext(actor, businessId);
    if (!hasPermission(context, permission)) {
      redirect("/account?denied=business");
    }
    return {
      actorId: actor.id,
      businessId: context.businessId,
      memberId: context.memberId,
      permissions: context.permissions,
      isOwner: context.isOwner,
    };
  } catch (error) {
    if (error instanceof BusinessAccessError) redirect("/account?denied=business");
    throw error;
  }
}
