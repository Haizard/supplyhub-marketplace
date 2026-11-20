import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ReturnRequestForm } from "@/components/storefront/return-request-form";
import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { getReturnableVendorOrders } from "@/features/returns/queries";
import { getServerI18n } from "@/i18n/server";
import { requireActor } from "@/server/auth/guards";
import { getDatabase } from "@/server/db/client";

export const metadata: Metadata = {
  title: "Return request",
  description: "Ask a studio to take an object back.",
  robots: { index: false, follow: false },
};

function searchParamValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function ReturnRequestPage({
  params,
  searchParams,
}: PageProps<"/orders/[orderNumber]/return">) {
  return (
    <Suspense fallback={<ReturnSkeleton />}>
      <ReturnContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ReturnContent({
  params,
  searchParams,
}: {
  params: PageProps<"/orders/[orderNumber]/return">["params"];
  searchParams: PageProps<"/orders/[orderNumber]/return">["searchParams"];
}) {
  const [{ orderNumber }, query] = await Promise.all([params, searchParams]);
  const [actor, { t }] = await Promise.all([
    requireActor(`/orders/${orderNumber}`),
    getServerI18n(),
  ]);

  const order = await getDatabase().order.findFirst({
    where: { orderNumber, customerId: actor.id },
    select: { id: true, orderNumber: true },
  });

  if (!order) {
    notFound();
  }

  const vendorOrderId = searchParamValue(query.vendorOrderId);
  const vendorOrders = await getReturnableVendorOrders(order.id, actor.id);
  const vendorOrder =
    vendorOrders.find((candidate) => candidate.vendorOrderId === vendorOrderId) ?? null;

  return (
    <PageShell className="pt-10 sm:pt-14">
      <Link
        href={`/orders/${order.orderNumber}`}
        className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("returns.backToOrder")}
      </Link>

      <div className="mt-8 border-b border-border pb-8">
        <p className="eyebrow text-muted-foreground">{order.orderNumber}</p>
        <h1 className="mt-3 font-display text-4xl leading-none font-medium tracking-[-0.04em] text-balance sm:text-5xl">
          {t("returns.title")}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
          {t("returns.intro")}
        </p>
      </div>

      <div className="mt-8 max-w-3xl">
        {vendorOrder ? (
          <ReturnRequestForm vendorOrderId={vendorOrder.vendorOrderId} items={vendorOrder.items} />
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">{t("returns.notEligible")}</p>
        )}
      </div>
    </PageShell>
  );
}

function ReturnSkeleton() {
  return (
    <PageShell className="pt-10 sm:pt-14">
      <div role="status" aria-label="Loading the return form" className="space-y-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full max-w-3xl" />
      </div>
    </PageShell>
  );
}
