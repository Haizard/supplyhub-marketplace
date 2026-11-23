import "server-only";

import { redirect } from "next/navigation";

import { getSessionActor } from "@/server/auth/session";
import { hasPermission } from "@/server/business/permissions";

import { LogisticsAccessError, resolveLogisticsContext, type LogisticsContext } from "./context";

/** Guards a company-scoped page or mutation. Never trusts a client-supplied role. */
export async function requireLogisticsAccess(
  permission: string,
  companyId: string,
  nextPath = "/logistics",
): Promise<LogisticsContext> {
  const actor = await getSessionActor();
  if (!actor) {
    redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  }

  try {
    const context = await resolveLogisticsContext(actor, companyId);
    if (!hasPermission(context, permission)) {
      redirect("/account?denied=logistics");
    }
    return context;
  } catch (error) {
    if (error instanceof LogisticsAccessError) {
      redirect("/account?denied=logistics");
    }
    throw error;
  }
}

/** Non-throwing variant for pages that want to render a locked state. */
export async function tryLogisticsAccess(companyId: string): Promise<LogisticsContext | null> {
  const actor = await getSessionActor();
  if (!actor) return null;
  return resolveLogisticsContext(actor, companyId).catch(() => null);
}
