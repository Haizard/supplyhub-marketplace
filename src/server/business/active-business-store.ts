import "server-only";

import { getDatabase } from "@/server/db/client";

import { selectActiveBusiness, type BusinessMembershipOption } from "./active-business";

/**
 * Loads the actor's active business memberships and selects the one in effect.
 *
 * Every request re-reads memberships from PostgreSQL, so removing a member,
 * suspending a business, or switching in another tab applies immediately.
 */
export async function loadActiveBusiness(
  userId: string,
  preferredBusinessId: string | null,
): Promise<BusinessMembershipOption | null> {
  const memberships = await getDatabase().businessMember.findMany({
    where: { userId, status: "active" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      businessId: true,
      status: true,
      business: {
        select: {
          name: true,
          vendors: { select: { id: true, status: true }, take: 1 },
        },
      },
      roles: {
        select: { role: { select: { name: true, isSystem: true } } },
      },
    },
  });

  const options: BusinessMembershipOption[] = memberships.map((membership) => ({
    businessId: membership.businessId,
    businessName: membership.business.name,
    memberId: membership.id,
    status: membership.status,
    isOwner: membership.roles.some((entry) => entry.role.isSystem && entry.role.name === "owner"),
    vendorId: membership.business.vendors[0]?.id ?? null,
    vendorStatus: membership.business.vendors[0]?.status ?? null,
  }));

  return selectActiveBusiness(options, preferredBusinessId);
}
