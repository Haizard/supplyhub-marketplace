import "server-only";

import { z } from "zod";

import { getDatabase } from "@/server/db/client";

import type { RankedCandidate } from "./types";

const rankingSchema = z.array(
  z.object({
    membershipId: z.string(),
    score: z.number(),
    eligible: z.boolean(),
    source: z.enum(["BASELINE", "AI"]),
    rationale: z.string().optional(),
  }),
);

export interface PendingRequestView {
  id: string;
  requestNumber: string;
  pickupName: string;
  dropoffName: string;
  createdAt: string;
}

export interface RankingView {
  membershipId: string;
  driverName: string;
  score: number;
  eligible: boolean;
  source: string;
  rationale?: string;
}

export interface SuggestionView {
  id: string;
  requestNumber: string;
  source: string;
  status: string;
  model: string | null;
  note: string | null;
  inputHash: string;
  ranking: RankingView[];
  baselineRanking: RankingView[];
  createdAt: string;
}

function parseRanking(value: unknown): RankedCandidate[] {
  const parsed = rankingSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export async function listOptimizationRequests(companyId: string): Promise<PendingRequestView[]> {
  const rows = await getDatabase().deliveryRequest.findMany({
    where: {
      companyId,
      source: "COMPANY",
      status: "PENDING",
      jobs: {
        none: { status: { in: ["ASSIGNED", "ACCEPTED", "TO_PICKUP", "AT_PICKUP", "TRANSIT"] } },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      requestNumber: true,
      pickupName: true,
      dropoffName: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    requestNumber: row.requestNumber,
    pickupName: row.pickupName,
    dropoffName: row.dropoffName,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listOptimizationSuggestions(companyId: string): Promise<SuggestionView[]> {
  const rows = await getDatabase().logisticsOptimizationSuggestion.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      source: true,
      status: true,
      model: true,
      note: true,
      inputHash: true,
      baselineRanking: true,
      ranking: true,
      createdAt: true,
      request: { select: { requestNumber: true } },
    },
  });

  const membershipIds = new Set<string>();
  for (const row of rows) {
    for (const candidate of parseRanking(row.ranking)) membershipIds.add(candidate.membershipId);
  }
  const memberships =
    membershipIds.size === 0
      ? []
      : await getDatabase().driverCompanyMembership.findMany({
          where: { id: { in: [...membershipIds] }, companyId },
          select: { id: true, driver: { select: { fullName: true } } },
        });
  const names = new Map(memberships.map((member) => [member.id, member.driver.fullName]));

  const toViews = (value: unknown): RankingView[] =>
    parseRanking(value).map((candidate) => ({
      ...candidate,
      driverName: names.get(candidate.membershipId) ?? "Unavailable",
    }));

  return rows.map((row) => ({
    id: row.id,
    requestNumber: row.request.requestNumber,
    source: row.source,
    status: row.status,
    model: row.model,
    note: row.note,
    inputHash: row.inputHash,
    ranking: toViews(row.ranking),
    baselineRanking: toViews(row.baselineRanking),
    createdAt: row.createdAt.toISOString(),
  }));
}
