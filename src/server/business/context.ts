import "server-only";

import { getDatabase } from "@/server/db/client";
import type { Actor } from "@/server/auth/actor";

import { BusinessAccessError, type BusinessContext } from "./permissions";

export { BusinessAccessError, hasPermission, requirePermission } from "./permissions";
export type { BusinessContext } from "./permissions";

/**
 * Resolves the authenticated user's membership and permissions for a given
 * business. Throws BusinessAccessError if the business does not exist, the
 * user is not a member, or the member is suspended.
 *
 * Platform admins bypass the membership check and receive all permissions.
 */
export async function resolveBusinessContext(
  actor: Actor,
  businessId: string,
): Promise<BusinessContext> {
  // Admins have unrestricted access to any business.
  if (actor.role === "ADMIN") {
    return {
      businessId,
      memberId: "",
      permissions: new Set(["*"]),
      isOwner: false,
    };
  }

  const db = getDatabase();

  const business = await db.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  });

  if (!business) {
    throw new BusinessAccessError("not-found", "That business does not exist.");
  }

  const member = await db.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId: actor.id } },
    select: {
      id: true,
      status: true,
      roles: {
        select: {
          role: {
            select: {
              permissions: { select: { permission: { select: { permissionKey: true } } } },
              isSystem: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!member) {
    throw new BusinessAccessError("not-member", "You are not a member of this business.");
  }

  if (member.status !== "active") {
    throw new BusinessAccessError("suspended", "Your access to this business has been suspended.");
  }

  const permissions = new Set<string>();
  let isOwner = false;

  for (const mr of member.roles) {
    if (mr.role.isSystem && mr.role.name === "owner") {
      isOwner = true;
    }
    for (const rp of mr.role.permissions) {
      permissions.add(rp.permission.permissionKey);
    }
  }

  return { businessId, memberId: member.id, permissions, isOwner };
}
