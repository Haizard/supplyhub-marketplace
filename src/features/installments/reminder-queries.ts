import "server-only";

import { getDatabase } from "@/server/db/client";

export interface InstallmentReminderView {
  id: string;
  agreementNumber: string;
  reminderType: string;
  status: string;
  dueAt: string;
  sentAt: string | null;
}

export async function listBusinessInstallmentReminders(
  businessId: string,
): Promise<InstallmentReminderView[]> {
  const rows = await getDatabase().installmentReminder.findMany({
    where: { agreement: { businessId } },
    orderBy: { dueAt: "desc" },
    take: 25,
    select: {
      id: true,
      reminderType: true,
      status: true,
      dueAt: true,
      sentAt: true,
      agreement: { select: { agreementNumber: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    agreementNumber: row.agreement.agreementNumber,
    reminderType: row.reminderType,
    status: row.status,
    dueAt: row.dueAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
  }));
}
