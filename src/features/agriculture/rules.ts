export interface ListingForOffer {
  quantity: number;
  unit: string;
  minimumOrder: number;
  status: string;
  currency: string;
}

export interface RequestForOffer {
  quantity: number;
  unit: string;
  offerDeadline: Date;
  status: string;
}

export type OfferValidation = { ok: true } | { ok: false; reason: string };

export function validateOffer(
  listing: ListingForOffer,
  request: RequestForOffer | null,
  offer: { quantity: number; unit: string; pricePerUnit: number; currency: string },
): OfferValidation {
  if (listing.status !== "PUBLISHED") return { ok: false, reason: "Listing is not published." };
  if (offer.unit !== listing.unit)
    return { ok: false, reason: "Offer unit differs from the listing." };
  if (offer.currency !== listing.currency)
    return { ok: false, reason: "Offer currency differs from the listing." };
  if (offer.quantity < listing.minimumOrder) {
    return { ok: false, reason: `Minimum order is ${listing.minimumOrder} ${listing.unit}.` };
  }
  if (offer.quantity > listing.quantity) {
    return { ok: false, reason: "Offer exceeds the listed quantity." };
  }
  if (request) {
    if (request.status !== "OPEN") return { ok: false, reason: "Buyer request is closed." };
    if (request.unit !== offer.unit)
      return { ok: false, reason: "Offer unit differs from the request." };
    if (offer.quantity > request.quantity)
      return { ok: false, reason: "Offer exceeds the requested quantity." };
  }
  return { ok: true };
}

export function requestIsOpen(
  request: { offerDeadline: Date; status: string },
  now = new Date(),
): boolean {
  return request.status === "OPEN" && request.offerDeadline.getTime() > now.getTime();
}

export function contractTotalMinor(quantity: number, pricePerUnit: number): number {
  return Math.round(quantity * pricePerUnit * 100);
}
