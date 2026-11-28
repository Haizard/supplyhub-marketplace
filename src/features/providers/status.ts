import type { ProviderApplicationStatus, ProviderType } from "@/generated/prisma/enums";

export const PROVIDER_TYPES: readonly ProviderType[] = [
  "FARMER",
  "LOGISTICS_COMPANY",
  "SERVICE_PROVIDER",
];

export const PROVIDER_STATUS_TONES: Record<
  ProviderApplicationStatus,
  "neutral" | "accent" | "success" | "danger"
> = {
  PENDING: "accent",
  APPROVED: "success",
  REJECTED: "danger",
  WITHDRAWN: "neutral",
};

export const PROVIDER_TYPE_KEYS: Record<ProviderType, string> = {
  FARMER: "providers.type.FARMER",
  LOGISTICS_COMPANY: "providers.type.LOGISTICS_COMPANY",
  SERVICE_PROVIDER: "providers.type.SERVICE_PROVIDER",
};

export const PROVIDER_STATUS_KEYS: Record<ProviderApplicationStatus, string> = {
  PENDING: "providers.status.PENDING",
  APPROVED: "providers.status.APPROVED",
  REJECTED: "providers.status.REJECTED",
  WITHDRAWN: "providers.status.WITHDRAWN",
};

/** A provider is public-facing only while the reviewer's decision says so. */
export function isProviderApproved(status: ProviderApplicationStatus | null | undefined): boolean {
  return status === "APPROVED";
}

/** Approving an application is the only thing that verifies the entity. */
export function entityStatusForDecision(decision: "APPROVED" | "REJECTED") {
  return decision === "APPROVED" ? "VERIFIED" : "REJECTED";
}
