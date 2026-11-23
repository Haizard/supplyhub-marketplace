"use client";

import { ArrowUpRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

export function SecurityPanel() {
  const { t } = useI18n();

  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <div className="flex size-11 items-center justify-center rounded-xl bg-[#0f766e]/10 text-[#0f766e]">
        <ShieldCheck className="size-5" aria-hidden="true" />
      </div>
      <h2 className="mt-5 font-display text-xl font-medium">{t("experience.security.title")}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {t("experience.security.body")}
      </p>
      <Button asChild className="mt-6">
        <Link href="/account/security">
          {t("experience.security.openSettings")}
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );
}
