"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/server/auth/guards";

import { dispatchOutboxEvents } from "./service";
import type { OutboxDispatchResult } from "./types";

export type OutboxActionResult =
  ({ ok: true; message: string } & { result: OutboxDispatchResult }) | { ok: false; error: string };

export async function dispatchOutboxAction(): Promise<OutboxActionResult> {
  await requireAdmin();
  const result = await dispatchOutboxEvents(50);
  revalidatePath("/admin/outbox");
  revalidatePath("/admin");
  return {
    ok: true,
    result,
    message: `Claimed ${result.claimed}; published ${result.published}; failed ${result.failed}; retrying ${result.retryScheduled}.`,
  };
}
