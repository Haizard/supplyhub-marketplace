"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";

import { centsToDecimalString } from "@/features/catalog/money";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { makeDocumentNumber } from "@/features/b2b/pricing";
import { appendOutboxEvent } from "@/features/outbox/service";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireAdmin } from "@/server/auth/guards";
import { getDatabase } from "@/server/db/client";
import { isFeatureEnabled } from "@/features/flags/service";

import { canTransitionCorridor } from "./status";
import { corridorSchema, corridorStatusSchema } from "./validation";

function decimal(cents: number): Prisma.Decimal {
  return new Prisma.Decimal(centsToDecimalString(cents));
}

function parseStops(formData: FormData): {
  branchId: string;
  stopOrder: number;
  label?: string;
}[] {
  const branchIds = formData.getAll("stopBranchId");
  const stopOrders = formData.getAll("stopOrder");
  const labels = formData.getAll("stopLabel");

  const stops: { branchId: string; stopOrder: number; label?: string }[] = [];

  for (let i = 0; i < branchIds.length; i++) {
    const branchId = branchIds[i];
    const orderRaw = stopOrders[i];
    const labelRaw = labels[i];

    if (typeof branchId !== "string" || !branchId) continue;

    const stopOrder = typeof orderRaw === "string" ? Number(orderRaw) : 0;
    if (!Number.isInteger(stopOrder) || stopOrder < 1) continue;

    const label = typeof labelRaw === "string" && labelRaw.trim() ? labelRaw.trim() : undefined;

    stops.push({ branchId, stopOrder, label });
  }

  return stops;
}

export async function saveCorridorAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  if (!(await isFeatureEnabled("phase7.regionalLogistics"))) {
    return { status: "error", message: "Regional logistics is not enabled." };
  }

  const parsed = corridorSchema.safeParse({
    corridorId: formValue(formData, "corridorId") || undefined,
    name: formValue(formData, "name"),
    description: formValue(formData, "description") || undefined,
    originBranchId: formValue(formData, "originBranchId"),
    destBranchId: formValue(formData, "destBranchId"),
    currency: formValue(formData, "currency"),
    baseFee: formValue(formData, "baseFee"),
    perKmFee: formValue(formData, "perKmFee"),
    estimatedKm: formValue(formData, "estimatedKm"),
    estimatedHours: formValue(formData, "estimatedHours"),
    stops: parseStops(formData),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error) };
  }

  const data = parsed.data;

  if (data.originBranchId === data.destBranchId) {
    return {
      status: "error",
      fieldErrors: { destBranchId: "Destination must differ from origin." },
    };
  }

  const db = getDatabase();

  try {
    await db.$transaction(async (tx) => {
      if (data.corridorId) {
        const existing = await tx.regionalCorridor.findUnique({
          where: { id: data.corridorId },
          select: { id: true, status: true },
        });

        if (!existing) {
          throw new Error("not-found");
        }

        await tx.regionalCorridor.update({
          where: { id: data.corridorId },
          data: {
            name: data.name,
            description: data.description ?? "",
            originBranchId: data.originBranchId,
            destBranchId: data.destBranchId,
            currency: data.currency,
            baseFee: decimal(data.baseFee),
            perKmFee: decimal(data.perKmFee),
            estimatedKm: data.estimatedKm,
            estimatedHours: data.estimatedHours,
          },
        });

        await tx.corridorStop.deleteMany({ where: { corridorId: data.corridorId } });

        if (data.stops.length > 0) {
          await tx.corridorStop.createMany({
            data: data.stops.map((stop) => ({
              corridorId: data.corridorId!,
              branchId: stop.branchId,
              stopOrder: stop.stopOrder,
              label: stop.label ?? "",
            })),
          });
        }

        await appendOutboxEvent(tx, {
          eventType: "regional_corridor.updated",
          aggregateType: "RegionalCorridor",
          aggregateId: data.corridorId,
          payload: {
            name: data.name,
            originBranchId: data.originBranchId,
            destBranchId: data.destBranchId,
          },
        });

        await recordAuditEvent(tx, {
          actorId: admin.id,
          action: "REGIONAL_CORRIDOR_UPDATED",
          targetType: "RegionalCorridor",
          targetId: data.corridorId,
          metadata: { name: data.name },
        });
      } else {
        const corridorCode = makeDocumentNumber("RC");

        const created = await tx.regionalCorridor.create({
          data: {
            corridorCode,
            name: data.name,
            description: data.description ?? "",
            originBranchId: data.originBranchId,
            destBranchId: data.destBranchId,
            currency: data.currency,
            baseFee: decimal(data.baseFee),
            perKmFee: decimal(data.perKmFee),
            estimatedKm: data.estimatedKm,
            estimatedHours: data.estimatedHours,
            stops:
              data.stops.length > 0
                ? {
                    create: data.stops.map((stop) => ({
                      branchId: stop.branchId,
                      stopOrder: stop.stopOrder,
                      label: stop.label ?? "",
                    })),
                  }
                : undefined,
          },
          select: { id: true },
        });

        await appendOutboxEvent(tx, {
          eventType: "regional_corridor.created",
          aggregateType: "RegionalCorridor",
          aggregateId: created.id,
          payload: {
            corridorCode,
            name: data.name,
            originBranchId: data.originBranchId,
            destBranchId: data.destBranchId,
          },
        });

        await recordAuditEvent(tx, {
          actorId: admin.id,
          action: "REGIONAL_CORRIDOR_CREATED",
          targetType: "RegionalCorridor",
          targetId: created.id,
          metadata: { corridorCode, name: data.name },
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "not-found") {
      return { status: "error", message: "Corridor not found." };
    }
    throw error;
  }

  revalidatePath("/admin/corridors");
  revalidatePath("/corridors");
  if (data.corridorId) {
    revalidatePath(`/admin/corridors/${data.corridorId}`);
  }

  return {
    status: "success",
    message: data.corridorId ? "Corridor updated." : "Corridor created.",
  };
}

export async function updateCorridorStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  if (!(await isFeatureEnabled("phase7.regionalLogistics"))) {
    return { status: "error", message: "Regional logistics is not enabled." };
  }

  const parsed = corridorStatusSchema.safeParse({
    id: formValue(formData, "id"),
    toStatus: formValue(formData, "toStatus"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error) };
  }

  const { id, toStatus } = parsed.data;
  const db = getDatabase();

  try {
    await db.$transaction(async (tx) => {
      const corridor = await tx.regionalCorridor.findUnique({
        where: { id },
        select: { id: true, status: true, name: true },
      });

      if (!corridor) {
        throw new Error("not-found");
      }

      if (!canTransitionCorridor(corridor.status as "DRAFT" | "ACTIVE" | "INACTIVE", toStatus)) {
        throw new Error("invalid-transition");
      }

      await tx.regionalCorridor.update({
        where: { id },
        data: {
          status: toStatus,
          activatedAt: toStatus === "ACTIVE" ? new Date() : null,
        },
      });

      await appendOutboxEvent(tx, {
        eventType: "regional_corridor.status_changed",
        aggregateType: "RegionalCorridor",
        aggregateId: id,
        payload: { status: toStatus },
      });

      await recordAuditEvent(tx, {
        actorId: admin.id,
        action:
          toStatus === "ACTIVE" ? "REGIONAL_CORRIDOR_ACTIVATED" : "REGIONAL_CORRIDOR_DEACTIVATED",
        targetType: "RegionalCorridor",
        targetId: id,
        metadata: { name: corridor.name, status: toStatus },
      });
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "not-found") {
        return { status: "error", message: "Corridor not found." };
      }
      if (error.message === "invalid-transition") {
        return { status: "error", message: "This corridor cannot be transitioned to that status." };
      }
    }
    throw error;
  }

  revalidatePath("/admin/corridors");
  revalidatePath("/corridors");
  revalidatePath(`/admin/corridors/${id}`);

  return {
    status: "success",
    message: toStatus === "ACTIVE" ? "Corridor activated." : "Corridor deactivated.",
  };
}
