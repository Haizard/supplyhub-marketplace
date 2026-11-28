import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getServerI18n } from "@/i18n/server";
import { cn } from "@/lib/utils/cn";

/**
 * The public "verified provider" badge. It is rendered only by callers that
 * read an APPROVED provider application, so the badge cannot come from a
 * seeded status flag.
 */
export async function ProviderVerifiedBadge({ className }: { className?: string }) {
  const { t } = await getServerI18n();
  return (
    <Badge tone="success" className={cn(className)}>
      <ShieldCheck className="size-3" aria-hidden="true" />
      {t("providers.badge")}
    </Badge>
  );
}
