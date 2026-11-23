import type { Metadata } from "next";
import { Suspense } from "react";

import { VerificationReviewForm } from "@/components/admin/verification-review-form";
import { PageShell } from "@/components/storefront/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { listPendingVerificationDocuments } from "@/features/verification/queries";
import { requireAdmin } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Business verification",
  robots: { index: false, follow: false },
};

export default function AdminVerificationPage() {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-80" />}>
      <AdminVerificationContent />
    </Suspense>
  );
}

async function AdminVerificationContent() {
  await requireAdmin();
  const documents = await listPendingVerificationDocuments();

  return (
    <PageShell className="space-y-6 py-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Business verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review submitted KYC documents. Approving the last pending document verifies a business.
        </p>
      </header>

      {documents.length === 0 ? (
        <EmptyState
          title="Nothing to review"
          description="Submitted documents will appear here for approval or rejection."
        />
      ) : (
        <ul className="space-y-3">
          {documents.map((document) => (
            <li key={document.id} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{document.documentType}</p>
                  <p className="text-sm">{document.businessName}</p>
                  <p className="text-xs text-muted-foreground">
                    {document.reference} · {document.storageKey} ·{" "}
                    {new Date(document.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="mt-4 max-w-lg">
                <VerificationReviewForm documentId={document.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
