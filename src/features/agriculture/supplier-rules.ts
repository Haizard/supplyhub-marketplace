export const REGULATED_INPUT_CATEGORIES = [
  "SEED",
  "FERTILIZER",
  "CROP_PROTECTION",
  "ANIMAL_FEED",
  "VETERINARY",
] as const;

export const QUALIFIED_SERVICE_TYPES = ["SPRAYING", "SOIL_TESTING", "AGRONOMY"] as const;

export type PublishResult = { ok: true } | { ok: false; reason: string };

export function canPublishInput(input: {
  verificationStatus: string;
  supplierType: string;
  category: string;
  registrationRef: string | null | undefined;
}): PublishResult {
  if (input.verificationStatus !== "VERIFIED") {
    return { ok: false, reason: "Supplier must be verified before publishing inputs." };
  }
  if (input.supplierType === "SERVICE") {
    return { ok: false, reason: "This supplier is registered for services only." };
  }
  if (
    (REGULATED_INPUT_CATEGORIES as readonly string[]).includes(input.category) &&
    !input.registrationRef?.trim()
  ) {
    return {
      ok: false,
      reason: "Regulated inputs require a registration or licence reference.",
    };
  }
  return { ok: true };
}

export function canPublishService(input: {
  verificationStatus: string;
  supplierType: string;
  serviceType: string;
  qualificationRef: string | null | undefined;
}): PublishResult {
  if (input.verificationStatus !== "VERIFIED") {
    return { ok: false, reason: "Supplier must be verified before publishing services." };
  }
  if (input.supplierType === "INPUT") {
    return { ok: false, reason: "This supplier is registered for inputs only." };
  }
  if (
    (QUALIFIED_SERVICE_TYPES as readonly string[]).includes(input.serviceType) &&
    !input.qualificationRef?.trim()
  ) {
    return { ok: false, reason: "This service requires a qualification reference." };
  }
  return { ok: true };
}

const BOOKING_TRANSITIONS: Record<string, string[]> = {
  REQUESTED: ["QUOTED", "CANCELLED"],
  QUOTED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
};

export function canTransitionBooking(from: string, to: string): boolean {
  return (BOOKING_TRANSITIONS[from] ?? []).includes(to);
}

/** A booked day is reserved for one job; documented default duration is 24h. */
export function bookingsOverlap(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date },
): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
}

export function inputOrderTotalMinor(quantity: number, pricePerUnit: number): number {
  return Math.round(quantity * pricePerUnit * 100);
}
