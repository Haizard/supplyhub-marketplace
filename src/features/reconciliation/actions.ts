"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/server/auth/guards";

import { reconcilePayments } from "./service";

export async function runReconciliationAction(): Promise<
  | { status: "success"; runNumber: string; checkedCount: number; findingCount: number }
  | { status: "error"; message: string }
> {
  const admin = await requireAdmin();
  try {
    const result = await reconcilePayments(admin.id);
    revalidatePath("/admin/reconciliation");
    revalidatePath(`/admin/reconciliation/${result.runId}`);
    return { status: "success", ...result };
  } catch {
    return { status: "error", message: "Reconciliation could not be completed." };
  }
}
