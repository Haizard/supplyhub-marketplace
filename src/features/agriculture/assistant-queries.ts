import "server-only";

import { getDatabase } from "@/server/db/client";

export interface SavedAdviceView {
  id: string;
  requestId: string;
  question: string;
  language: string;
  source: string;
  note: string | null;
  createdAt: string;
  summary: string;
  recommendations: { topic: string; advice: string; confidence: number; evidence: string[] }[];
  caveats: string[];
}

export async function listAgricultureAdvice(farmerId: string): Promise<SavedAdviceView[]> {
  const rows = await getDatabase().agricultureAdvice.findMany({
    where: { farmerId },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  return rows.map((row) => {
    const advice = (row.advice ?? {}) as {
      summary?: string;
      recommendations?: {
        topic: string;
        advice: string;
        confidence: number;
        evidence: string[];
      }[];
      caveats?: string[];
    };
    return {
      id: row.id,
      requestId: row.requestId,
      question: row.question,
      language: row.language,
      source: row.source,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
      summary: advice.summary ?? "",
      recommendations: advice.recommendations ?? [],
      caveats: advice.caveats ?? [],
    };
  });
}
