import type { Metadata } from "next";
import Link from "next/link";

import { AgricultureAssistantForm } from "@/components/agriculture/assistant-form";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { isFeatureEnabled } from "@/features/flags/service";
import { listAgricultureAdvice } from "@/features/agriculture/assistant-queries";
import { getFarmerSummary } from "@/features/agriculture/queries";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Agriculture assistant",
  robots: { index: false, follow: false },
};

export default async function AgricultureAssistantPage() {
  const actor = await requireActor("/agriculture/assistant");
  const enabled = await isFeatureEnabled("phase11.agricultureNetwork");
  const [farmer, advice] = await Promise.all([
    getFarmerSummary(actor.id),
    listAgricultureAdvice(actor.id),
  ]);

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Agriculture assistant</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Advisory answers grounded in your farm records, crop costs, harvest weights, offers and
          input prices. AI is opt-in; deterministic record-based guidance is the fallback.
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

      {farmer ? (
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="font-display text-lg font-medium">Ask a question</h2>
          <div className="mt-4">
            <AgricultureAssistantForm />
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Register a farmer profile first.</p>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Saved answers</h2>
        {advice.map((item) => (
          <article
            key={item.id}
            className="space-y-2 rounded-xl border border-border bg-surface p-5 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{item.question}</p>
                <p className="text-xs text-muted-foreground">
                  {item.language.toUpperCase()} · {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              <Badge tone={item.source === "AI" ? "success" : "neutral"}>{item.source}</Badge>
            </div>
            <p>{item.summary}</p>
            <ul className="space-y-1 text-xs">
              {item.recommendations.map((recommendation, index) => (
                <li key={`${recommendation.topic}-${index}`}>
                  <span className="font-medium">{recommendation.topic}</span> (
                  {recommendation.confidence}%) {recommendation.advice}
                  <span className="text-muted-foreground">
                    {" "}
                    · evidence: {recommendation.evidence.join(", ") || "none"}
                  </span>
                </li>
              ))}
            </ul>
            {item.caveats.map((caveat, index) => (
              <p key={`${index}-${caveat}`} className="text-xs text-muted-foreground">
                {caveat}
              </p>
            ))}
            {item.note ? <p className="text-xs text-muted-foreground">{item.note}</p> : null}
          </article>
        ))}
        {advice.length === 0 ? (
          <p className="text-sm text-muted-foreground">No saved answers yet.</p>
        ) : null}
      </section>
    </PageShell>
  );
}
