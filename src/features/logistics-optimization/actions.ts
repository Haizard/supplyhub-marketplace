"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { makeDocumentNumber } from "@/features/b2b/pricing";
import { isFeatureEnabled } from "@/features/flags/service";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireLogisticsAccess } from "@/server/logistics/access";
import { getDatabase } from "@/server/db/client";

import { generateSuggestion } from "./ai";
import { hashOptimizationInput } from "./baseline";
import { buildOptimizationSignals } from "./service";
import { optimizationDecisionSchema, optimizationRequestSchema } from "./validation";

function fail(message: string): FormState {
  return { status: "error", message };
}
function failFields(error: z.ZodError): FormState {
  return { status: "error", fieldErrors: firstFieldErrors(error) };
}
function ok(message: string): FormState {
  return { status: "success", message };
}
const path = (companyId: string) => `/logistics/${companyId}/optimize`;

async function ensureEnabled(): Promise<FormState | null> {
  if (!(await isFeatureEnabled("phase9.logisticsNetwork"))) {
    return fail("The logistics network is not available yet.");
  }
  return null;
}

/**
 * Produces an advisory ranking. This action never creates or reassigns a job;
 * the existing dispatch action remains the only state transition.
 */
export async function requestOptimizationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = optimizationRequestSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    requestId: formValue(formData, "requestId"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.dispatch.manage",
    parsed.data.companyId,
    path(parsed.data.companyId),
  );
  const signals = await buildOptimizationSignals(access.companyId, parsed.data.requestId);
  if (!signals) {
    return fail("That request is not a pending request of your company.");
  }
  if (signals.candidates.length === 0) {
    return fail("No active company drivers are available for this request.");
  }

  const result = await generateSuggestion(signals);
  const inputHash = hashOptimizationInput(signals);

  await getDatabase().$transaction(async (tx) => {
    const suggestion = await tx.logisticsOptimizationSuggestion.create({
      data: {
        suggestionNumber: makeDocumentNumber("OS"),
        companyId: access.companyId,
        requestId: signals.requestId,
        createdById: access.actorId,
        source: result.source,
        model: result.model,
        inputHash,
        baselineRanking: result.baselineRanking as unknown as Prisma.InputJsonValue,
        ranking: result.ranking as unknown as Prisma.InputJsonValue,
        note: result.note.slice(0, 500),
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_OPTIMIZATION_SUGGESTED",
      targetType: "LogisticsOptimizationSuggestion",
      targetId: suggestion.id,
      metadata: {
        companyId: access.companyId,
        requestId: signals.requestId,
        source: result.source,
        model: result.model,
        inputHash,
        candidateCount: signals.candidates.length,
      },
    });
  });

  revalidatePath(path(access.companyId));
  return ok(
    result.source === "AI"
      ? `AI advisory ranking saved for ${signals.candidates.length} drivers. No job was assigned.`
      : `Baseline ranking saved for ${signals.candidates.length} drivers. ${result.note}`,
  );
}

/** Records a dispatcher's decision. Acceptance does not auto-assign the job. */
export async function decideOptimizationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = optimizationDecisionSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    suggestionId: formValue(formData, "suggestionId"),
    decision: formValue(formData, "decision"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.dispatch.manage",
    parsed.data.companyId,
    path(parsed.data.companyId),
  );
  const status =
    parsed.data.decision === "ACCEPT"
      ? "ACCEPTED"
      : parsed.data.decision === "REJECT"
        ? "REJECTED"
        : "BASELINE_USED";

  const result = await getDatabase().$transaction(async (tx) => {
    const suggestion = await tx.logisticsOptimizationSuggestion.findFirst({
      where: { id: parsed.data.suggestionId, companyId: access.companyId, status: "PENDING" },
      select: { id: true },
    });
    if (!suggestion) return "not-found" as const;
    await tx.logisticsOptimizationSuggestion.update({
      where: { id: suggestion.id },
      data: { status, decidedAt: new Date(), decidedById: access.actorId },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_OPTIMIZATION_DECIDED",
      targetType: "LogisticsOptimizationSuggestion",
      targetId: suggestion.id,
      metadata: { companyId: access.companyId, status },
    });
    return "ok" as const;
  });

  revalidatePath(path(access.companyId));
  if (result === "not-found") return fail("That suggestion is no longer pending.");
  return ok(
    status === "BASELINE_USED"
      ? "Baseline ranking recorded. Use dispatch to assign a job."
      : "Decision recorded. Use dispatch to assign a job.",
  );
}
