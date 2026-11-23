import type { Metadata } from "next";
import { Suspense } from "react";

import { VerificationDocumentForm } from "@/components/verification/document-form";
import { PageShell } from "@/components/storefront/page-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { requireBusinessAccess } from "@/features/b2b/access";
import {
  listBusinessVerificationDocuments,
  listVerificationReviews,
} from "@/features/verification/queries";
import { getDatabase } from "@/server/db/client";

export const metadata: Metadata = {
  title: "Business verification",
  robots: { index: false, follow: false },
};

export default function BusinessVerificationPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <BusinessVerificationContent params={params} />
    </Suspense>
  );
}

async function BusinessVerificationContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireBusinessAccess(
    id,
    "verification.manage",
    `/business/${id}/verification`,
  );
  const [documents, reviews, business] = await Promise.all([
    listBusinessVerificationDocuments(access.businessId),
    listVerificationReviews(access.businessId),
    getDatabase().business.findUnique({
      where: { id: access.businessId },
      select: { name: true, verificationStatus: true },
    }),
  ]);

  return (
    <PageShell className="space-y-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-tight">Business verification</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {business?.name ?? "Business"} · Submit documents for administrator review.
          </p>
        </div>
        <Badge tone={business?.verificationStatus === "verified" ? "success" : "neutral"}>
          {business?.verificationStatus ?? "unverified"}
        </Badge>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-3">
          <h2 className="font-display text-lg font-medium">Submitted documents</h2>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents submitted yet.</p>
          ) : (
            <ul className="space-y-2">
              {documents.map((document) => (
                <li
                  key={document.id}
                  className="rounded-xl border border-border bg-surface p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{document.documentType}</span>
                    <Badge tone={document.status === "APPROVED" ? "success" : "neutral"}>
                      {document.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {document.reference} · {document.storageKey}
                  </p>
                  {document.reviewNote ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Review: {document.reviewNote}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-6">
            <h2 className="font-display text-lg font-medium">Submit a document</h2>
            <div className="mt-4">
              <VerificationDocumentForm businessId={access.businessId} />
            </div>
          </div>
          {reviews.length > 0 ? (
            <div className="rounded-xl border border-border bg-surface p-6">
              <h2 className="font-display text-lg font-medium">Recent decisions</h2>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                {reviews.map((review) => (
                  <li key={review.id}>
                    {review.decision} · {new Date(review.createdAt).toLocaleDateString()}
                    {review.note ? ` · ${review.note}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </section>
    </PageShell>
  );
}
