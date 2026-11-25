import type { Metadata } from "next";
import Link from "next/link";

import { AcceptInstallmentForm } from "@/components/installments/forms";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listBuyerInstallments } from "@/features/installments/queries";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "My installment agreements",
  robots: { index: false, follow: false },
};

export default async function BuyerInstallmentsPage() {
  const actor = await requireActor("/account/installments");
  const agreements = await listBuyerInstallments(actor.id);

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">My installment agreements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review terms, deposits and payment schedules. Nothing is charged from this page.
        </p>
      </header>

      {agreements.length === 0 ? (
        <p className="text-sm text-muted-foreground">No installment agreements yet.</p>
      ) : null}

      {agreements.map((agreement) => (
        <article
          key={agreement.id}
          className="space-y-3 rounded-xl border border-border bg-surface p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-sm">{agreement.agreementNumber}</p>
              <p className="text-sm text-muted-foreground">Seller: {agreement.counterpartyName}</p>
              <p className="text-xs text-muted-foreground">
                Outstanding {agreement.outstandingBalance} {agreement.currency}
                {agreement.nextDueDate
                  ? ` · next due ${new Date(agreement.nextDueDate).toLocaleDateString()}`
                  : ""}
              </p>
            </div>
            <Badge tone={agreement.status === "ACTIVE" ? "success" : "neutral"}>
              {agreement.status}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/account/installments/${agreement.id}`}>View agreement</Link>
            </Button>
            {agreement.status === "PENDING_CUSTOMER_ACCEPTANCE" ? (
              <AcceptInstallmentForm agreementId={agreement.id} />
            ) : null}
          </div>
        </article>
      ))}
    </PageShell>
  );
}
