import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { Skeleton } from "@/components/ui/skeleton";
import { ConsolePageHeader } from "@/components/console/console-ui";
import { getLogisticsCompany, listCompanyActivity } from "@/features/logistics-companies/queries";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Company activity",
  robots: { index: false, follow: false },
};

export default function CompanyActivityPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <CompanyActivityContent params={params} />
    </Suspense>
  );
}

async function CompanyActivityContent({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) notFound();
  await requireLogisticsAccess(
    "logistics.company.read",
    companyId,
    `/logistics/${companyId}/activity`,
  );
  const [company, activity] = await Promise.all([
    getLogisticsCompany(companyId),
    listCompanyActivity(companyId),
  ]);
  if (!company) notFound();

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        title="Activity"
        description="Company events from the platform audit log, newest first."
      />

      {activity.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {activity.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="font-mono text-xs">{entry.action}</p>
                <p className="text-xs text-muted-foreground">{entry.targetType}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(entry.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
