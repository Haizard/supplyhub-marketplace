"use client";

import { Badge } from "@/components/ui/badge";
import { useT } from "@/i18n/client";

type Tone = "neutral" | "accent" | "clay" | "success" | "danger";

function toneFor(status: string): Tone {
  if (status === "PAID" || status === "RECEIVED" || status === "ACCEPTED" || status === "ACTIVE") {
    return "success";
  }
  if (
    status === "CANCELLED" ||
    status === "REJECTED" ||
    status === "EXPIRED" ||
    status === "OVERDUE"
  ) {
    return "danger";
  }
  if (
    status === "SUBMITTED" ||
    status === "QUOTED" ||
    status === "SENT" ||
    status === "SHIPPED" ||
    status === "PROCESSING" ||
    status === "ISSUED"
  ) {
    return "clay";
  }
  if (status === "CONFIRMED" || status === "PAUSED") {
    return "accent";
  }
  return "neutral";
}

export function B2bStatusBadge({ status }: { status: string }) {
  const t = useT();
  return <Badge tone={toneFor(status)}>{t(`b2b.status.${status}`)}</Badge>;
}
