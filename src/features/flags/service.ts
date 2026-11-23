import "server-only";

import { recordAuditEvent } from "@/server/audit/audit-log";
import { getDatabase } from "@/server/db/client";
import { appendOutboxEvent } from "@/features/outbox/service";

import { normalizeFeatureFlagKey } from "./key";
import type { FeatureFlagView } from "./types";

function toView(row: {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): FeatureFlagView {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listFeatureFlags(): Promise<FeatureFlagView[]> {
  const rows = await getDatabase().featureFlag.findMany({
    orderBy: { key: "asc" },
  });
  return rows.map(toView);
}

export async function getFeatureFlag(key: string): Promise<FeatureFlagView | null> {
  const row = await getDatabase().featureFlag.findUnique({
    where: { key: normalizeFeatureFlagKey(key) },
  });
  return row ? toView(row) : null;
}

export async function isFeatureEnabled(key: string): Promise<boolean> {
  const flag = await getFeatureFlag(key);
  return flag?.enabled ?? false;
}

export async function createFeatureFlag(input: {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  actorId: string;
}): Promise<FeatureFlagView> {
  const database = getDatabase();
  const key = normalizeFeatureFlagKey(input.key);

  return database.$transaction(async (tx) => {
    const row = await tx.featureFlag.create({
      data: {
        key,
        name: input.name,
        description: input.description,
        enabled: input.enabled,
      },
    });

    await appendOutboxEvent(tx, {
      eventType: "feature_flag.created",
      aggregateType: "FeatureFlag",
      aggregateId: row.id,
      payload: { key: row.key, enabled: row.enabled },
    });
    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "FEATURE_FLAG_CREATED",
      targetType: "FeatureFlag",
      targetId: row.id,
      metadata: { key: row.key, enabled: row.enabled },
    });

    return toView(row);
  });
}

export async function setFeatureFlagEnabled(input: {
  id: string;
  enabled: boolean;
  actorId: string;
}): Promise<FeatureFlagView | null> {
  const database = getDatabase();

  return database.$transaction(async (tx) => {
    const existing = await tx.featureFlag.findUnique({ where: { id: input.id } });
    if (!existing || existing.enabled === input.enabled) {
      return existing ? toView(existing) : null;
    }

    const row = await tx.featureFlag.update({
      where: { id: input.id },
      data: { enabled: input.enabled },
    });

    await appendOutboxEvent(tx, {
      eventType: "feature_flag.updated",
      aggregateType: "FeatureFlag",
      aggregateId: row.id,
      payload: { key: row.key, enabled: row.enabled },
    });
    await recordAuditEvent(tx, {
      actorId: input.actorId,
      action: "FEATURE_FLAG_UPDATED",
      targetType: "FeatureFlag",
      targetId: row.id,
      metadata: { key: row.key, enabled: row.enabled },
    });

    return toView(row);
  });
}
