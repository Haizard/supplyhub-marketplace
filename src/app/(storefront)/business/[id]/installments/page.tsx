import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import {
  CancelInstallmentForm,
  CreateInstallmentForm,
  InstallmentSettingsForm,
} from "@/components/installments/forms";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getBusinessById } from "@/features/business/queries";
import { isFeatureEnabled } from "@/features/flags/service";
import { getInstallmentSettings, listSellerInstallments } from "@/features/installments/queries";
import { requireActor } from "@/server/auth/guards";
import {
  BusinessAccessError,
  hasPermission,
  resolveBusinessContext,
} from "@/server/business/context";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Installment sales",
  robots: { index: false, follow: false },
};

export default function InstallmentsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <InstallmentsContent params={params} />
    </Suspense>
  );
}

async function InstallmentsContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const actor = await requireActor(`/business/${id}/installments`);
  const business = await getBusinessById(id);
  if (!business) notFound();

  try {
    const context = await resolveBusinessContext(actor, id);
    if (!hasPermission(context, "installments.manage")) notFound();
  } catch (error) {
    if (error instanceof BusinessAccessError) notFound();
    throw error;
  }

  const enabled = await isFeatureEnabled("phase10.installmentSales");
  const [settings, agreements] = await Promise.all([
    getInstallmentSettings(id),
    listSellerInstallments(id),
  ]);

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Installment sales</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seller-funded contracts with a fixed price snapshot and a generated payment schedule.
          Payments are not collected in this slice — the buyer must accept the terms first.
        </p>
      </header>

      {!enabled ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
          Installment sales are disabled. An administrator must enable the
          <code className="px-1">phase10.installmentSales</code> flag first.
        </p>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Seller settings</h2>
        <div className="mt-4">
          <InstallmentSettingsForm businessId={id} settings={settings} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">New agreement</h2>
        {settings?.enabled ? (
          <div className="mt-4">
            <CreateInstallmentForm businessId={id} settings={settings} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Enable installment sales above before creating agreements.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Agreements</h2>
        {agreements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No installment agreements yet.</p>
        ) : null}
        {agreements.map((agreement) => (
          <article
            key={agreement.id}
            className="space-y-2 rounded-xl border border-border bg-surface p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm">{agreement.agreementNumber}</p>
                <p className="text-sm text-muted-foreground">Buyer: {agreement.counterpartyName}</p>
                <p className="text-xs text-muted-foreground">
                  Cash {agreement.cashPrice} · deposit {agreement.depositAmount} · outstanding{" "}
                  {agreement.outstandingBalance} {agreement.currency}
                  {agreement.nextDueDate
                    ? ` · next due ${new Date(agreement.nextDueDate).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <Badge tone={agreement.status === "PENDING_DEPOSIT" ? "success" : "neutral"}>
                {agreement.status}
              </Badge>
            </div>
            {["PENDING_CUSTOMER_ACCEPTANCE", "PENDING_DEPOSIT"].includes(agreement.status) ? (
              <CancelInstallmentForm businessId={id} agreementId={agreement.id} />
            ) : null}
            <Link
              href={`/business/${id}/installments/${agreement.id}`}
              className="text-xs text-accent underline"
            >
              View payments
            </Link>
          </article>
        ))}
      </section>
    </PageShell>
  );
}
