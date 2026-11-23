import "server-only";

import type { FindingSeverity, ReconciliationRunStatus } from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";

export interface ReconciliationRunView {
  id: string;
  runNumber: string;
  status: ReconciliationRunStatus;
  checkedCount: number;
  findingCount: number;
  finishedAt: string | null;
  createdAt: string;
}

export interface ReconciliationFindingView {
  id: string;
  severity: FindingSeverity;
  code: string;
  message: string;
  expected: string | null;
  actual: string | null;
  paymentId: string | null;
}

export interface ReconciliationRunDetail extends ReconciliationRunView {
  findings: ReconciliationFindingView[];
}

export async function listRecentReconciliationRuns(): Promise<ReconciliationRunView[]> {
  const rows = await getDatabase().reconciliationRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows.map((row) => ({
    id: row.id,
    runNumber: row.runNumber,
    status: row.status,
    checkedCount: row.checkedCount,
    findingCount: row.findingCount,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getReconciliationRun(id: string): Promise<ReconciliationRunDetail | null> {
  const database = getDatabase();
  const row = await database.reconciliationRun.findUnique({ where: { id } });
  if (!row) return null;
  const findings = await database.reconciliationFinding.findMany({
    where: { runId: id },
    orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
  });
  return {
    id: row.id,
    runNumber: row.runNumber,
    status: row.status,
    checkedCount: row.checkedCount,
    findingCount: row.findingCount,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    findings: findings.map((finding) => ({
      id: finding.id,
      severity: finding.severity,
      code: finding.code,
      message: finding.message,
      expected: finding.expected,
      actual: finding.actual,
      paymentId: finding.paymentId,
    })),
  };
}
