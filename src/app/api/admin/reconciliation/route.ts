import { NextResponse } from "next/server";

import { reconcilePayments } from "@/features/reconciliation/service";
import { logger } from "@/lib/logging/logger";
import { canPerformAdminAction } from "@/server/auth/policies";
import { getSessionActor } from "@/server/auth/session";

/** Cron-friendly trigger; still requires an authenticated administrator. */
export async function POST() {
  const actor = await getSessionActor();
  if (!actor || !canPerformAdminAction(actor)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await reconcilePayments(actor.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error("reconciliation.endpoint_failed", { error });
    return NextResponse.json({ ok: false, error: "Reconciliation failed" }, { status: 500 });
  }
}
