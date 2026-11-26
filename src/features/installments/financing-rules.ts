/** Status guards for the compliance-gated financing workflow. */
export function canDecideFinancing(status: string): boolean {
  return status === "SUBMITTED";
}

export function canAcceptFinancing(status: string): boolean {
  return status === "APPROVED";
}

export function canFundFinancing(status: string): boolean {
  return status === "ACCEPTED";
}
