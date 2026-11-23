import type { OutboxEventStatus } from "@/generated/prisma/enums";

export type OutboxEventView = {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string | null;
  payload: Record<string, unknown>;
  status: OutboxEventStatus;
  attempts: number;
  availableAt: string;
  publishedAt: string | null;
  lastError: string | null;
  createdAt: string;
};

export type OutboxDispatchResult = {
  claimed: number;
  published: number;
  failed: number;
  retryScheduled: number;
};
