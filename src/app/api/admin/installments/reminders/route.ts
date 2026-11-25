import { connection } from "next/server";
import { z } from "zod";

import { isFeatureEnabled } from "@/features/flags/service";
import {
  dispatchInstallmentReminders,
  queueInstallmentReminders,
} from "@/features/installments/reminder-service";
import { requireAdmin } from "@/server/auth/guards";

const bodySchema = z.object({
  action: z.enum(["SWEEP", "DISPATCH", "BOTH"]).default("BOTH"),
});

/** Cron-friendly admin endpoint. Session-authenticated administrator only. */
export async function POST(request: Request): Promise<Response> {
  await connection();

  if (!(await isFeatureEnabled("phase10.installmentSales"))) {
    return Response.json({ ok: false, error: "Installment sales not enabled" }, { status: 503 });
  }
  await requireAdmin();

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    raw = {};
  }
  const parsed = bodySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Invalid action." }, { status: 400 });
  }

  const sweep =
    parsed.data.action === "DISPATCH"
      ? { markedOverdue: 0, queued: 0 }
      : await queueInstallmentReminders();
  const dispatch =
    parsed.data.action === "SWEEP"
      ? { sent: 0, failed: 0, skipped: 0 }
      : await dispatchInstallmentReminders();

  return Response.json(
    { ok: true, ...sweep, ...dispatch },
    { headers: { "Cache-Control": "no-store" } },
  );
}
