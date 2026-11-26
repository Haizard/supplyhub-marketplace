import "server-only";

import { redirect } from "next/navigation";

import { getSessionActor } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";
import type { AgriculturalSupplier } from "@/generated/prisma/client";

export async function requireSupplierProfile(): Promise<AgriculturalSupplier> {
  const actor = await getSessionActor();
  if (!actor) redirect("/sign-in?next=/agriculture/suppliers");
  const supplier = await getDatabase().agriculturalSupplier.findUnique({
    where: { userId: actor.id },
  });
  if (!supplier) redirect("/agriculture/suppliers?setup=1");
  return supplier;
}

export async function requireVerifiedSupplier(): Promise<AgriculturalSupplier> {
  const supplier = await requireSupplierProfile();
  if (supplier.verificationStatus !== "VERIFIED") {
    throw new Error("Supplier must be verified before publishing.");
  }
  return supplier;
}
