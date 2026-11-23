import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSessionActor } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";

export const instant = false;

export const metadata: Metadata = {
  title: "Live delivery",
  description:
    "Open the database-backed delivery views: request and track your own jobs, manage courier jobs, or dispatch from the admin console.",
  robots: { index: false, follow: false },
};

/**
 * The original /delivery-live page was a device-local map simulation. Real
 * tracking lives in the logistics tables, so this route now resolves to the
 * correct database-backed view for the signed-in role.
 */
export default async function DeliveryLivePage() {
  const actor = await getSessionActor();

  if (!actor) {
    redirect("/delivery/request");
  }

  if (actor.role === "ADMIN") {
    redirect("/admin/delivery");
  }

  const agent = await getDatabase().deliveryAgent.findFirst({
    where: { userId: actor.id },
    select: { id: true },
  });

  redirect(agent ? "/courier" : "/delivery/request");
}
