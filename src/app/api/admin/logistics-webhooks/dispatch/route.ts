import { connection } from "next/server";

import { isFeatureEnabled } from "@/features/flags/service";
import { dispatchWebhookDeliveries } from "@/features/logistics-api/webhook-dispatch";
import { requireAdmin } from "@/server/auth/guards";

/** Cron-friendly endpoint; still requires an authenticated administrator. */
export async function POST(): Promise<Response> {
  await connection();

  if (!(await isFeatureEnabled("phase9.logisticsNetwork"))) {
    return Response.json({ ok: false, error: "Network not enabled" }, { status: 503 });
  }
  await requireAdmin();

  const result = await dispatchWebhookDeliveries(50);
  return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}
