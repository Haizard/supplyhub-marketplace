/** Rewards follow verified commercial activity, never registrations alone. */
export const QUALIFYING_DELIVERIES = 50;

export interface ReferralSignals {
  clientVerified: boolean;
  relationshipActive: boolean;
  completedDeliveries: number;
  paidInvoices: number;
  isSelfReferral: boolean;
  isDuplicateClient: boolean;
  referralOwnerCompanyId: string;
  clientCompanyIds: readonly string[];
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  qualifiesFor: {
    verificationPoints: boolean;
    firstDeliveryBonus: boolean;
    volumeBonus: boolean;
    retentionBonus: boolean;
  };
}

export function evaluateReferral(signals: ReferralSignals): EligibilityResult {
  const reasons: string[] = [];
  if (signals.isSelfReferral) reasons.push("self-referral");
  if (signals.isDuplicateClient) reasons.push("duplicate client");
  if (!signals.clientVerified) reasons.push("merchant not verified");
  if (!signals.relationshipActive)
    reasons.push("no active relationship with the referring company");
  if (signals.completedDeliveries < 1) reasons.push("no completed delivery");
  if (signals.paidInvoices < 1) reasons.push("no genuine payment transaction");

  const qualifiesFor = {
    verificationPoints:
      reasons.length === 0 && signals.clientCompanyIds.includes(signals.referralOwnerCompanyId),
    firstDeliveryBonus: reasons.length === 0 && signals.completedDeliveries >= 1,
    volumeBonus: signals.completedDeliveries >= QUALIFYING_DELIVERIES && signals.paidInvoices >= 1,
    retentionBonus: signals.relationshipActive && signals.clientVerified,
  };

  return { eligible: reasons.length === 0, reasons, qualifiesFor };
}

/** Configurable illustrative points; no cash reward is implied. */
export const REWARD_POINTS = {
  VERIFIED_MERCHANT: 100,
  FIRST_DELIVERY: 250,
  VOLUME_50: 500,
  CONTRACT_RENEWAL: 200,
} as const;
