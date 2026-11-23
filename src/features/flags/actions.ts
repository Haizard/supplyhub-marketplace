"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/server/auth/guards";

import { isValidFeatureFlagKey } from "./key";
import { createFeatureFlag, getFeatureFlag, setFeatureFlagEnabled } from "./service";

export type FeatureFlagActionResult = { ok: true; message: string } | { ok: false; error: string };

const createSchema = z.object({
  key: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .refine(isValidFeatureFlagKey, "Use lowercase letters, numbers, dots, dashes, or underscores."),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(600),
});

const toggleSchema = z.object({
  id: z.uuid(),
  enabled: z.boolean(),
});

function refreshAdmin(): void {
  revalidatePath("/admin/feature-flags");
  revalidatePath("/admin");
}

export async function createFeatureFlagAction(input: {
  key: string;
  name: string;
  description: string;
}): Promise<FeatureFlagActionResult> {
  const admin = await requireAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid key, name, and description." };
  }

  if (await getFeatureFlag(parsed.data.key)) {
    return { ok: false, error: "That feature flag key already exists." };
  }

  await createFeatureFlag({ ...parsed.data, enabled: false, actorId: admin.id });
  refreshAdmin();
  return { ok: true, message: "Feature flag created." };
}

export async function setFeatureFlagEnabledAction(input: {
  id: string;
  enabled: boolean;
}): Promise<FeatureFlagActionResult> {
  const admin = await requireAdmin();
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That feature flag could not be updated." };
  }

  const flag = await setFeatureFlagEnabled({ ...parsed.data, actorId: admin.id });
  if (!flag) {
    return { ok: false, error: "Feature flag not found." };
  }

  refreshAdmin();
  return { ok: true, message: flag.enabled ? "Feature flag enabled." : "Feature flag disabled." };
}
