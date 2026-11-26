import type { Metadata } from "next";
import Link from "next/link";

import {
  ActivityForm,
  CropForm,
  CropStatusForm,
  ExpenseForm,
  HarvestForm,
} from "@/components/agriculture/farm-forms";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { isFeatureEnabled } from "@/features/flags/service";
import { getFarmManagementData } from "@/features/agriculture/farm-queries";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Farm management",
  robots: { index: false, follow: false },
};

export default async function FarmManagementPage() {
  const actor = await requireActor("/agriculture/farm-management");
  const enabled = await isFeatureEnabled("phase11.agricultureNetwork");
  const data = await getFarmManagementData(actor.id);
  const farms = data.farmer?.farms ?? [];
  const plots = farms.flatMap((farm) => farm.plots);
  const crops = data.crops.map((crop) => ({
    id: crop.id,
    name: `${crop.cropName}${crop.variety ? ` · ${crop.variety}` : ""}`,
  }));

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Farm management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crop cycles, farming activities, expenses and harvest batches. Cost per kilogram is
          computed from recorded expenses and recorded harvest weights only — expected harvest is
          not income.
        </p>
        <Link href="/agriculture/farmer" className="text-xs text-accent underline">
          Back to farmer portal
        </Link>
      </header>
      {!enabled ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
          The agriculture network is not enabled yet.
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-4">
        <p className="rounded-xl border border-border bg-surface p-4 text-sm">
          Crops: {data.season.cropCount}
        </p>
        <p className="rounded-xl border border-border bg-surface p-4 text-sm">
          Harvested: {data.season.harvestedCount}
        </p>
        <p className="rounded-xl border border-border bg-surface p-4 text-sm">
          Recorded cost: {data.season.totalCost}
        </p>
        <p className="rounded-xl border border-border bg-surface p-4 text-sm">
          Harvest weight: {data.season.harvestedKg} kg
        </p>
      </section>

      {farms.length > 0 ? <CropForm farms={farms} plots={plots} /> : null}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Crop cycles</h2>
        {data.crops.map((crop) => (
          <article
            key={crop.id}
            className="space-y-3 rounded-xl border border-border bg-surface p-5 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {crop.cropName} {crop.variety ? `· ${crop.variety}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Planted{" "}
                  {crop.plantedAt ? new Date(crop.plantedAt).toLocaleDateString() : "not recorded"}
                  {crop.expectedHarvestAt
                    ? ` · expected ${new Date(crop.expectedHarvestAt).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={crop.status === "HARVESTED" ? "success" : "neutral"}>
                  {crop.status}
                </Badge>
                <CropStatusForm cropId={crop.id} status={crop.status} />
              </div>
            </div>
            <p className="text-xs">
              Recorded cost {crop.totalCost} · harvested {crop.harvestedKg} kg · cost/kg{" "}
              <span className="font-medium">{crop.costPerKg ?? "not available"}</span>
            </p>
            <details className="text-xs">
              <summary className="cursor-pointer text-accent">
                Activities, expenses and harvests
              </summary>
              <div className="mt-2 space-y-1 text-muted-foreground">
                {crop.activities.map((activity, index) => (
                  <p key={`${activity.type}-${index}`}>
                    {activity.type} · {new Date(activity.occurredAt).toLocaleDateString()} ·{" "}
                    {activity.note ?? ""}
                  </p>
                ))}
                {crop.expenses.map((expense, index) => (
                  <p key={`${expense.category}-${index}`}>
                    {expense.category} · {expense.amount} {expense.currency} ·{" "}
                    {new Date(expense.occurredAt).toLocaleDateString()}
                  </p>
                ))}
                {crop.harvests.map((harvest, index) => (
                  <p key={`${harvest.harvestedAt}-${index}`}>
                    Harvest · {harvest.quantity} {harvest.unit} ·{" "}
                    {new Date(harvest.harvestedAt).toLocaleDateString()}
                  </p>
                ))}
              </div>
            </details>
          </article>
        ))}
        {data.crops.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No crop cycles yet. Register a farm first.
          </p>
        ) : null}
      </section>

      {crops.length > 0 ? (
        <>
          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="font-display text-lg font-medium">Record activity</h2>
            <div className="mt-4">
              <ActivityForm crops={crops} />
            </div>
          </section>
          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="font-display text-lg font-medium">Record expense</h2>
            <div className="mt-4">
              <ExpenseForm crops={crops} />
            </div>
          </section>
          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="font-display text-lg font-medium">Record harvest</h2>
            <div className="mt-4">
              <HarvestForm crops={crops} />
            </div>
          </section>
        </>
      ) : null}
    </PageShell>
  );
}
