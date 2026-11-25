import "server-only";

import { getDatabase } from "@/server/db/client";

export interface InstallmentStockView {
  id: string;
  agreementNumber: string;
  productName: string;
  quantity: number;
  status: string;
  createdAt: string;
}

export async function listInstallmentStockReservations(
  businessId: string,
): Promise<InstallmentStockView[]> {
  const rows = await getDatabase().installmentStockReservation.findMany({
    where: { agreement: { businessId } },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      quantity: true,
      status: true,
      createdAt: true,
      product: { select: { name: true } },
      agreement: { select: { agreementNumber: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    agreementNumber: row.agreement.agreementNumber,
    productName: row.product.name,
    quantity: row.quantity,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }));
}
