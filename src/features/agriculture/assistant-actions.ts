"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { makeDocumentNumber } from "@/features/b2b/pricing";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireActor } from "@/server/auth/guards";
import { getDatabase } from "@/server/db/client";
import { getServerEnv } from "@/lib/config/env";

import { ensureAgricultureEnabled, requireFarmerProfile } from "./access";
import {
  buildAgricultureSignals,
  generateAgricultureAdvice,
  signalsHash,
} from "./assistant-service";

function fail(message: string): FormState {
  return { status: "error", message };
}
function failFields(error: z.ZodError): FormState {
  return { status: "error", fieldErrors: firstFieldErrors(error) };
}
function ok(message: string): FormState {
  return { status: "success", message };
}

const questionSchema = z.object({
  question: z.string().trim().min(5).max(500),
  language: z.enum(["en", "sw"]),
});

export async function requestAgricultureAdviceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await ensureAgricultureEnabled();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Agriculture network unavailable.");
  }

  const parsed = questionSchema.safeParse({
    question: formValue(formData, "question"),
    language: formValue(formData, "language"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const actor = await requireActor("/agriculture/assistant");
  const farmer = await requireFarmerProfile();
  const database = getDatabase();
  const requestId = makeDocumentNumber("AA");
  const signals = await buildAgricultureSignals(database, {
    farmerUserId: actor.id,
    requestId,
    question: parsed.data.question,
    language: parsed.data.language,
  });
  const result = await generateAgricultureAdvice(signals);

  await database.$transaction(async (tx) => {
    const record = await tx.agricultureAdvice.create({
      data: {
        farmerId: farmer.id,
        requestId,
        question: parsed.data.question,
        language: parsed.data.language,
        source: result.source,
        model: result.source === "AI" ? getServerEnv().GEMINI_MODEL : null,
        signalsHash: signalsHash(signals),
        baseline: result.advice as unknown as Prisma.InputJsonValue,
        advice: result.advice as unknown as Prisma.InputJsonValue,
        note: result.note.slice(0, 500),
      },
      select: { id: true },
    });
    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "AGRICULTURE_ADVICE_GENERATED",
      targetType: "AgricultureAdvice",
      targetId: record.id,
      metadata: { source: result.source, language: parsed.data.language },
    });
  });

  revalidatePath("/agriculture/assistant");
  return ok(`Advice generated (${result.source}). Open a saved answer to read it.`);
}
