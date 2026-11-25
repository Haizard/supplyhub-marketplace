import { timingSafeEqual } from "node:crypto";

export interface ShareActivationInput {
  status: string;
  ownerApproved: boolean;
  partnerApproved: boolean;
  ownerConsentedAt: Date | null;
  partnerConsentedAt: Date | null;
  insurancePolicyRef: string | null;
  insuranceExpiresAt: Date | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  accountableIsParty: boolean;
  vehicles: {
    plate: string;
    status: string;
    insuranceExpiresAt: Date | null;
    committedElsewhere: boolean;
  }[];
}

export type ShareActivationResult = { ok: true } | { ok: false; reason: string };

/** Insurance must exist and be in the future; a missing expiry is never assumed valid. */
export function isInsuranceCurrent(expiresAt: Date | null, now = new Date()): boolean {
  return expiresAt instanceof Date && expiresAt.getTime() > now.getTime();
}

/**
 * A sharing agreement can only go live with two-sided consent, platform approval,
 * current insurance, at least one uncommitted vehicle and a single accountable party.
 */
export function evaluateShareActivation(
  input: ShareActivationInput,
  now = new Date(),
): ShareActivationResult {
  if (input.status !== "PENDING_PARTNER") {
    return { ok: false, reason: "Only an offer awaiting the partner can be activated." };
  }
  if (!input.ownerConsentedAt || !input.partnerConsentedAt) {
    return { ok: false, reason: "Both companies must consent before activation." };
  }
  if (!input.ownerApproved || !input.partnerApproved) {
    return { ok: false, reason: "Both companies must be verified by the platform." };
  }
  if (!input.accountableIsParty) {
    return { ok: false, reason: "The accountable company must be one of the two parties." };
  }
  if (!input.insurancePolicyRef?.trim() || !isInsuranceCurrent(input.insuranceExpiresAt, now)) {
    return { ok: false, reason: "A current insurance policy is required before activation." };
  }
  if (input.effectiveTo && input.effectiveTo.getTime() <= now.getTime()) {
    return { ok: false, reason: "The agreement's effective window has already ended." };
  }
  if (input.effectiveFrom.getTime() > (input.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY)) {
    return { ok: false, reason: "The effective window is inverted." };
  }
  if (input.vehicles.length === 0) {
    return { ok: false, reason: "At least one vehicle must be shared." };
  }
  const unavailable = input.vehicles.find((vehicle) => vehicle.status !== "ACTIVE");
  if (unavailable) {
    return { ok: false, reason: `Vehicle ${unavailable.plate} is not active.` };
  }
  const expired = input.vehicles.find(
    (vehicle) =>
      vehicle.insuranceExpiresAt !== null && !isInsuranceCurrent(vehicle.insuranceExpiresAt, now),
  );
  if (expired) {
    return { ok: false, reason: `Vehicle ${expired.plate} has expired insurance.` };
  }
  const committed = input.vehicles.find((vehicle) => vehicle.committedElsewhere);
  if (committed) {
    return {
      ok: false,
      reason: `Vehicle ${committed.plate} is already committed under another active agreement.`,
    };
  }
  return { ok: true };
}

export interface Window {
  from: Date;
  to: Date | null;
}

/** Two agreements overlap when their effective windows intersect. */
export function windowsOverlap(a: Window, b: Window): boolean {
  const aEnd = a.to?.getTime() ?? Number.POSITIVE_INFINITY;
  const bEnd = b.to?.getTime() ?? Number.POSITIVE_INFINITY;
  return a.from.getTime() <= bEnd && b.from.getTime() <= aEnd;
}

/** A hub cannot accept more parcels than its declared capacity. */
export function hubHasCapacity(storedCount: number, capacity: number): boolean {
  return capacity > 0 && storedCount < capacity;
}

/** Constant-time comparison for a short numeric pickup code. */
export function pickupCodeMatches(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided.trim(), "utf8");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

export function canReleaseHandover(status: string, pickupCodeVerifiedAt: Date | null): boolean {
  return status === "STORED" && pickupCodeVerifiedAt === null;
}
