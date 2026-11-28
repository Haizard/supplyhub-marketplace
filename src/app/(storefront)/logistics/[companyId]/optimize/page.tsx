import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import {
  OptimizationDecisionForm,
  OptimizationRequestForm,
} from "@/components/logistics/optimization-forms";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConsolePageHeader } from "@/components/console/console-ui";
import { getLogisticsCompany } from "@/features/logistics-companies/queries";
import {
  listOptimizationRequests,
  listOptimizationSuggestions,
  type RankingView,
} from "@/features/logistics-optimization/queries";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Dispatch optimisation",
  robots: { index: false, follow: false },
};

export default function OptimizationPage({ params }: { params: Promise<{ companyId: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <OptimizationContent params={params} />
    </Suspense>
  );
}

function RankingList({ title, ranking }: { title: string; ranking: RankingView[] }) {
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-medium">{title}</h3>
      <ol className="mt-2 space-y-1 text-xs">
        {ranking.map((candidate, index) => (
          <li key={candidate.membershipId} className="rounded-md bg-surface-muted px-2 py-1">
            {index + 1}. {candidate.driverName} · {candidate.score}
            {candidate.eligible ? "" : " · ineligible"}
            {candidate.rationale ? ` — ${candidate.rationale}` : ""}
          </li>
        ))}
        {ranking.length === 0 ? (
          <li className="text-muted-foreground">No ranking recorded.</li>
        ) : null}
      </ol>
    </div>
  );
}

async function OptimizationContent({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) notFound();
  await requireLogisticsAccess(
    "logistics.dispatch.manage",
    companyId,
    `/logistics/${companyId}/optimize`,
  );
  const [company, requests, suggestions] = await Promise.all([
    getLogisticsCompany(companyId),
    listOptimizationRequests(companyId),
    listOptimizationSuggestions(companyId),
  ]);
  if (!company) notFound();

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        title="Dispatch optimisation"
        description="Advisory driver ordering only. The deterministic baseline is always stored and used when AI is disabled, unavailable or invalid. No job is assigned or reassigned from this page."
      />

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Generate a ranking</h2>
        {requests.length > 0 ? (
          <div className="mt-4">
            <OptimizationRequestForm companyId={companyId} requests={requests} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No pending company requests without an active job.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-medium">Saved suggestions</h2>
        {suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No suggestions recorded yet.</p>
        ) : null}
        {suggestions.map((suggestion) => (
          <article
            key={suggestion.id}
            className="space-y-3 rounded-xl border border-border bg-surface p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{suggestion.requestNumber}</p>
                <p className="text-xs text-muted-foreground">
                  Source: {suggestion.source} · model: {suggestion.model ?? "none"} ·{" "}
                  {new Date(suggestion.createdAt).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">{suggestion.note}</p>
                <p className="font-mono text-[10px] break-all text-muted-foreground">
                  input hash: {suggestion.inputHash}
                </p>
              </div>
              <Badge tone={suggestion.status === "ACCEPTED" ? "success" : "neutral"}>
                {suggestion.status}
              </Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <RankingList title="Deterministic baseline" ranking={suggestion.baselineRanking} />
              <RankingList title="Saved ranking" ranking={suggestion.ranking} />
            </div>
            <OptimizationDecisionForm
              companyId={companyId}
              suggestionId={suggestion.id}
              status={suggestion.status}
            />
          </article>
        ))}
      </section>
    </div>
  );
}
