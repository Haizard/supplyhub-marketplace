import type { LogisticsCompanyStatus } from "@/generated/prisma/enums";

/** Forward-only company lifecycle. A rejected company cannot self-reapply in L1. */
export const COMPANY_TRANSITIONS: Readonly<
  Record<LogisticsCompanyStatus, readonly LogisticsCompanyStatus[]>
> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: ["SUSPENDED"],
  SUSPENDED: ["APPROVED"],
  REJECTED: [],
};

export function canTransitionCompany(
  from: LogisticsCompanyStatus,
  to: LogisticsCompanyStatus,
): boolean {
  return COMPANY_TRANSITIONS[from]?.includes(to) ?? false;
}

export const COMPANY_STATUS_LABELS: Record<LogisticsCompanyStatus, string> = {
  PENDING: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};
