import { Suspense } from "react";
import { z } from "zod";

import { CompanyConsole } from "@/components/logistics/console-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { getLogisticsCompany } from "@/features/logistics-companies/queries";
import { tryLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export default function LogisticsCompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto my-8 h-96 w-full max-w-[88rem]" />}>
      <CompanyConsoleChrome params={params}>{children}</CompanyConsoleChrome>
    </Suspense>
  );
}

/**
 * Members get the management console around every company page. Everyone else
 * (buyers, signed-out visitors, other companies) falls through to the page's
 * own public profile, which is why the chrome is decided here and not per page.
 */
async function CompanyConsoleChrome({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) return <>{children}</>;

  const [company, access] = await Promise.all([
    getLogisticsCompany(companyId),
    tryLogisticsAccess(companyId),
  ]);
  if (!company || !access) return <>{children}</>;

  return <CompanyConsole company={company}>{children}</CompanyConsole>;
}
