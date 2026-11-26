import type { Metadata } from "next";

import { InputPurchaseForm } from "@/components/agriculture/supplier-forms";
import { PageShell } from "@/components/storefront/page-shell";
import { isFeatureEnabled } from "@/features/flags/service";
import { listPublishedInputs } from "@/features/agriculture/supplier-queries";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Agricultural inputs",
  robots: { index: false, follow: false },
};

export default async function AgriculturalInputsPage() {
  await requireActor("/agriculture/inputs");
  const enabled = await isFeatureEnabled("phase11.agricultureNetwork");
  const inputs = await listPublishedInputs();

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Agricultural inputs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seeds, fertilizer, manure and compost, feeds, tools and irrigation. Regulated inputs
          require a registration reference and a verified supplier.
        </p>
      </header>
      {!enabled ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
          The agriculture network is not enabled yet.
        </p>
      ) : null}
      {inputs.map((input) => (
        <article
          key={input.id}
          className="space-y-2 rounded-xl border border-border bg-surface p-5 text-sm"
        >
          <p className="font-medium">
            {input.name} · {input.category.replaceAll("_", " ")}
          </p>
          <p className="text-xs text-muted-foreground">
            {input.quantity} {input.unit} @ {input.pricePerUnit} {input.currency} · minimum{" "}
            {input.minimumOrder} {input.unit}
          </p>
          <p className="text-xs text-muted-foreground">
            Seller {input.supplierName} ({input.verificationStatus})
            {input.treatmentStatus ? ` · ${input.treatmentStatus}` : ""}
            {input.registrationRef ? ` · reg ${input.registrationRef}` : ""}
            {input.organicClaim ? " · organic claim (unverified)" : ""}
          </p>
          <InputPurchaseForm inputId={input.id} />
        </article>
      ))}
      {inputs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No inputs published.</p>
      ) : null}
    </PageShell>
  );
}
