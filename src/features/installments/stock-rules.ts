export interface StockAvailability {
  catalogueStock: number;
  warehouseStock: number;
  quantity: number;
}

/** Both the catalogue and the warehouse must cover a hold. */
export function canHoldStock(input: StockAvailability): boolean {
  return (
    Number.isInteger(input.quantity) &&
    input.quantity > 0 &&
    input.catalogueStock >= input.quantity &&
    input.warehouseStock >= input.quantity
  );
}

/** HELD units become a sale only when the agreed possession condition is met. */
export function shouldConvertReservation(
  possessionModel: "IMMEDIATE" | "AFTER_FULL_PAYMENT",
  agreementStatus: string,
): boolean {
  return (
    (possessionModel === "IMMEDIATE" && agreementStatus === "ACTIVE") ||
    (possessionModel === "AFTER_FULL_PAYMENT" && agreementStatus === "COMPLETED")
  );
}
