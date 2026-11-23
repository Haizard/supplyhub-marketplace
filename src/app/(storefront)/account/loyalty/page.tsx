import type { Metadata } from "next";
import { Suspense } from "react";
import { Award, Gift, History } from "lucide-react";

import { PageShell } from "@/components/storefront/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { RedeemButton } from "@/features/loyalty/components/redeem-button";
import { getLoyaltyAccountView } from "@/features/loyalty/queries";
import { getServerI18n } from "@/i18n/server";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Loyalty points",
  robots: { index: false, follow: false },
};

export default function LoyaltyPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto my-10 h-96 max-w-[1000px]" />}>
      <LoyaltyContent />
    </Suspense>
  );
}

async function LoyaltyContent() {
  const [actor, { t }] = await Promise.all([requireActor("/account/loyalty"), getServerI18n()]);
  const account = await getLoyaltyAccountView(actor.id);

  return (
    <PageShell className="py-10 sm:py-14">
      <header className="border-b border-border pb-6">
        <p className="eyebrow text-muted-foreground">{t("loyalty.eyebrow")}</p>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tight sm:text-4xl">
          {t("loyalty.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("loyalty.subtitle")}</p>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#0f766e]/30 bg-[#0f766e]/5 p-5">
          <Award className="size-5 text-[#0f766e]" aria-hidden="true" />
          <p className="mt-3 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {t("loyalty.balance")}
          </p>
          <p className="mt-1 font-display text-4xl font-medium text-[#0f766e]">
            {account.pointsBalance.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {t("loyalty.tier")}
          </p>
          <p className="mt-3 font-display text-2xl font-medium">
            {t(`loyalty.tiers.${account.tier}`)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {account.progress.nextTier
              ? t("loyalty.nextTier", {
                  tier: t(`loyalty.tiers.${account.progress.nextTier}`),
                  remaining: account.progress.remaining ?? 0,
                })
              : t("loyalty.maxTier")}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-[#0f766e]"
              style={{ width: `${account.progress.percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("loyalty.lifetime", { points: account.lifetimePoints.toLocaleString() })}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <Gift className="size-5 text-accent" aria-hidden="true" />
          <h2 className="mt-3 font-display text-lg font-medium">{t("loyalty.redeemTitle")}</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t("loyalty.redeemBody", {
              cost: account.redemptionPointCost,
              value: account.redemptionValue.toLocaleString(),
            })}
          </p>
          <RedeemButton pointsBalance={account.pointsBalance} cost={account.redemptionPointCost} />
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-surface p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-medium">
          <History className="size-5 text-muted-foreground" aria-hidden="true" />
          {t("loyalty.history")}
        </h2>
        {account.transactions.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("loyalty.empty")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {account.transactions.map((transaction) => (
              <li key={transaction.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium">{t(`loyalty.type.${transaction.type}`)}</p>
                  <p className="text-xs text-muted-foreground">{transaction.description}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-semibold ${
                      transaction.points > 0 ? "text-[#0f766e]" : "text-accent"
                    }`}
                  >
                    {transaction.points > 0 ? "+" : ""}
                    {transaction.points.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("loyalty.balanceAfter", {
                      points: transaction.balanceAfter.toLocaleString(),
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageShell>
  );
}
