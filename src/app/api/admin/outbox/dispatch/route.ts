import { NextResponse } from "next/server";

import { dispatchOutboxEvents } from "@/features/outbox/service";
import { requireAdmin } from "@/server/auth/guards";

/** Admin-triggered drain. A scheduler can call this with an admin session. */
export async function POST(): Promise<Response> {
  await requireAdmin();
  const result = await dispatchOutboxEvents(50);
  return NextResponse.json({ ok: true, result });
}
