import "server-only";

import type { VerificationReviewStatus } from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";

export interface VerificationDocumentView {
  id: string;
  businessId: string;
  businessName: string;
  documentType: string;
  reference: string;
  storageKey: string;
  status: VerificationReviewStatus;
  reviewNote: string | null;
  createdAt: string;
}

type Row = {
  id: string;
  businessId: string;
  documentType: string;
  reference: string;
  storageKey: string;
  status: VerificationReviewStatus;
  reviewNote: string | null;
  createdAt: Date;
};

async function decorate(rows: Row[]): Promise<VerificationDocumentView[]> {
  if (rows.length === 0) return [];
  const businesses = await getDatabase().business.findMany({
    where: { id: { in: rows.map((r) => r.businessId) } },
    select: { id: true, name: true },
  });
  const names = new Map(businesses.map((b) => [b.id, b.name]));
  return rows.map((row) => ({
    id: row.id,
    businessId: row.businessId,
    businessName: names.get(row.businessId) ?? "Business",
    documentType: row.documentType,
    reference: row.reference,
    storageKey: row.storageKey,
    status: row.status,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listPendingVerificationDocuments(): Promise<VerificationDocumentView[]> {
  const rows = await getDatabase().businessVerificationDocument.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
  return decorate(rows);
}

export async function listBusinessVerificationDocuments(
  businessId: string,
): Promise<VerificationDocumentView[]> {
  const rows = await getDatabase().businessVerificationDocument.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
  });
  return decorate(rows);
}

export async function listVerificationReviews(businessId: string) {
  const rows = await getDatabase().businessVerificationReview.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows.map((row) => ({
    id: row.id,
    decision: row.decision,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  }));
}
