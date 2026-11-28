import "server-only";

import type { ProviderApplicationStatus, ProviderType } from "@/generated/prisma/enums";
import type { Actor } from "@/server/auth/actor";
import { getDatabase } from "@/server/db/client";

export interface ProviderApplicationSummary {
  id: string;
  applicationNumber: string;
  status: ProviderApplicationStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
}

/** One provider identity the signed-in person may apply for. */
export interface ProviderEntityOption {
  providerType: ProviderType;
  entityId: string;
  name: string;
  entityStatus: string;
  prefill: { phone: string; email: string; district: string };
  application: ProviderApplicationSummary | null;
}

export interface ProviderDocumentView {
  type: string;
  reference: string;
}

export interface ProviderQueueItem {
  id: string;
  applicationNumber: string;
  providerType: ProviderType;
  status: ProviderApplicationStatus;
  displayName: string;
  contactPhone: string;
  contactEmail: string;
  district: string | null;
  summary: string;
  documents: ProviderDocumentView[];
  applicantName: string;
  applicantEmail: string;
  entityStatus: string;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
}

const applicationSelect = {
  id: true,
  applicationNumber: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  reviewNote: true,
} as const;

function toSummary(row: {
  id: string;
  applicationNumber: string;
  status: ProviderApplicationStatus;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewNote: string | null;
}): ProviderApplicationSummary {
  return {
    id: row.id,
    applicationNumber: row.applicationNumber,
    status: row.status,
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNote: row.reviewNote,
  };
}

/** Never trust the stored JSON shape; drop anything that is not a reference. */
function parseDocuments(value: unknown): ProviderDocumentView[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const record = entry as Record<string, unknown>;
    const type = typeof record.type === "string" ? record.type : null;
    const reference = typeof record.reference === "string" ? record.reference : null;
    return type && reference ? [{ type, reference }] : [];
  });
}

/**
 * The provider identities attached to this account: the farmer profile they
 * own, the logistics companies they belong to, and the studio they own.
 */
export async function listApplicantProviderOptions(actor: Actor): Promise<ProviderEntityOption[]> {
  const database = getDatabase();
  const [farmer, companies, vendor] = await Promise.all([
    database.agricultureFarmer.findUnique({
      where: { userId: actor.id },
      select: {
        id: true,
        verificationStatus: true,
        phone: true,
        district: true,
        user: { select: { name: true, email: true } },
        providerApplication: { select: applicationSelect },
      },
    }),
    database.logisticsCompany.findMany({
      where: { members: { some: { userId: actor.id, status: "ACTIVE" } } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        contactPhone: true,
        contactEmail: true,
        city: true,
        providerApplication: { select: applicationSelect },
      },
    }),
    actor.vendor
      ? database.vendor.findUnique({
          where: { id: actor.vendor.id },
          select: {
            id: true,
            name: true,
            status: true,
            contactPhone: true,
            city: true,
            providerApplication: { select: applicationSelect },
          },
        })
      : Promise.resolve(null),
  ]);

  const options: ProviderEntityOption[] = [];

  if (farmer) {
    options.push({
      providerType: "FARMER",
      entityId: farmer.id,
      name: farmer.user.name,
      entityStatus: farmer.verificationStatus,
      prefill: {
        phone: farmer.phone ?? "",
        email: farmer.user.email,
        district: farmer.district ?? "",
      },
      application: farmer.providerApplication ? toSummary(farmer.providerApplication) : null,
    });
  }

  for (const company of companies) {
    options.push({
      providerType: "LOGISTICS_COMPANY",
      entityId: company.id,
      name: company.name,
      entityStatus: company.status,
      prefill: {
        phone: company.contactPhone ?? "",
        email: company.contactEmail ?? "",
        district: company.city ?? "",
      },
      application: company.providerApplication ? toSummary(company.providerApplication) : null,
    });
  }

  if (vendor) {
    options.push({
      providerType: "SERVICE_PROVIDER",
      entityId: vendor.id,
      name: vendor.name,
      entityStatus: vendor.status,
      prefill: {
        phone: vendor.contactPhone ?? "",
        email: actor.email,
        district: vendor.city ?? "",
      },
      application: vendor.providerApplication ? toSummary(vendor.providerApplication) : null,
    });
  }

  return options;
}

/** Admin review queue: pending first, then the most recent decisions. */
export async function listProviderApplicationQueue(
  status: ProviderApplicationStatus | "ALL" = "PENDING",
): Promise<ProviderQueueItem[]> {
  const rows = await getDatabase().providerApplication.findMany({
    where: status === "ALL" ? {} : { status },
    orderBy: status === "PENDING" ? { submittedAt: "asc" } : { reviewedAt: "desc" },
    take: 100,
    select: {
      id: true,
      applicationNumber: true,
      providerType: true,
      status: true,
      displayName: true,
      contactPhone: true,
      contactEmail: true,
      district: true,
      summary: true,
      documents: true,
      submittedAt: true,
      reviewedAt: true,
      reviewNote: true,
      applicant: { select: { name: true, email: true } },
      farmer: { select: { verificationStatus: true } },
      company: { select: { status: true } },
      vendor: { select: { status: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    applicationNumber: row.applicationNumber,
    providerType: row.providerType,
    status: row.status,
    displayName: row.displayName,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    district: row.district,
    summary: row.summary,
    documents: parseDocuments(row.documents),
    applicantName: row.applicant.name,
    applicantEmail: row.applicant.email,
    entityStatus:
      row.farmer?.verificationStatus ?? row.company?.status ?? row.vendor?.status ?? "—",
    submittedAt: row.submittedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNote: row.reviewNote,
  }));
}

/** Count for the admin landing tiles, without loading the queue. */
export async function countPendingProviderApplications(): Promise<number> {
  return getDatabase().providerApplication.count({ where: { status: "PENDING" } });
}
