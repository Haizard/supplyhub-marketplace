import "server-only";

import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/security/safe-redirect";

import { requireStudioAccess } from "@/server/business/studio-access";

import type { Actor } from "./actor";
import { canCheckout, canPerformAdminAction } from "./policies";
import { getSessionActor } from "./session";

export async function requireActor(nextPath = "/account"): Promise<Actor> {
  const actor = await getSessionActor();

  if (!actor) {
    redirect(`/sign-in?next=${encodeURIComponent(safeNextPath(nextPath, "/account"))}`);
  }

  return actor;
}

export async function requireCustomer(nextPath = "/checkout"): Promise<Actor> {
  const actor = await requireActor(nextPath);

  if (!canCheckout(actor)) {
    redirect("/account?denied=checkout");
  }

  return actor;
}

export async function requireAdmin(): Promise<Actor> {
  const actor = await requireActor("/admin/vendors");

  if (!canPerformAdminAction(actor)) {
    redirect("/account?denied=admin");
  }

  return actor;
}

/**
 * Resolves the single vendor whose studio the actor may open.
 *
 * Studio access is business-scoped: staff open the studio of the business they
 * belong to, and unlinked legacy vendors keep their original 1:1 studio. Pages
 * that mutate or expose scoped data call requireStudioAccess with the exact
 * permission they need.
 */
export async function requireApprovedVendor(
  nextPath = "/vendor",
): Promise<{ actor: Actor; vendorId: string }> {
  const access = await requireStudioAccess("business.read", nextPath);
  return { actor: access.actor, vendorId: access.vendorId };
}
