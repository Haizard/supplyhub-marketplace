import "server-only";

import { redirect } from "next/navigation";

import { getSessionActor } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";

export interface DriverContext {
  actorId: string;
  driverId: string;
  membershipId: string;
  companyId: string;
}

/** Guards the driver-facing portal. The driver is derived from the session. */
export async function requireDriverContext(companyId: string): Promise<DriverContext> {
  const actor = await getSessionActor();
  if (!actor) {
    redirect(`/sign-in?next=${encodeURIComponent(`/logistics/driver?company=${companyId}`)}`);
  }

  const profile = await getDatabase().driverProfile.findUnique({
    where: { userId: actor.id },
    select: { id: true },
  });
  if (!profile) redirect("/account?denied=driver");

  const membership = await getDatabase().driverCompanyMembership.findFirst({
    where: { companyId, driverId: profile.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!membership) redirect("/account?denied=driver");

  return {
    actorId: actor.id,
    driverId: profile.id,
    membershipId: membership.id,
    companyId,
  };
}
