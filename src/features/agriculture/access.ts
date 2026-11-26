import "server-only";

import { redirect } from "next/navigation";

import { getSessionActor } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";
import type { AgricultureFarmer } from "@/generated/prisma/client";

export async function ensureAgricultureEnabled(): Promise<void> {
  const { isFeatureEnabled } = await import("@/features/flags/service");
  if (!(await isFeatureEnabled("phase11.agricultureNetwork"))) {
    throw new Error("The agriculture network is not enabled.");
  }
}

/** Farmer actions must resolve the profile from the session, never from the form. */
export async function requireFarmerProfile(): Promise<AgricultureFarmer> {
  const actor = await getSessionActor();
  if (!actor) redirect("/sign-in?next=/agriculture/farmer");
  const farmer = await getDatabase().agricultureFarmer.findUnique({
    where: { userId: actor.id },
  });
  if (!farmer) redirect("/agriculture/farmer?setup=1");
  return farmer;
}

export async function requireVerifiedFarmer(): Promise<AgricultureFarmer> {
  const farmer = await requireFarmerProfile();
  if (farmer.verificationStatus !== "VERIFIED") {
    throw new Error("Your farmer profile must be verified before trading.");
  }
  return farmer;
}
