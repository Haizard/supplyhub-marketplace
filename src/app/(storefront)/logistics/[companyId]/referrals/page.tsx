import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import {
  AdvanceReferralForm,
  ReferralForm,
  RegisterReferralForm,
  RewardStatusForm,
} from "@/components/logistics/referral-forms";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConsolePageHeader } from "@/components/logistics/console-ui";
import { getLogisticsCompany } from "@/features/logistics-companies/queries";
import { QUALIFYING_DELIVERIES } from "@/features/partner-growth/eligibility";
import {
  listClientsForReferral,
  listCompanyReferrals,
  listCompanyRewards,
} from "@/features/partner-growth/queries";
import { requireLogisticsAccess } from "@/server/logistics/access";

const uuidSchema = z.uuid();

export const metadata: Metadata = {
  title: "Partner growth network",
  robots: { index: false, follow: false },
};

export default function CompanyReferralsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="m-8 h-96" />}>
      <CompanyReferralsContent params={params} />
    </Suspense>
  );
}

async function CompanyReferralsContent({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  if (!uuidSchema.safeParse(companyId).success) notFound();
  await requireLogisticsAccess(
    "logistics.referral.manage",
    companyId,
    `/logistics/${companyId}/referrals`,
  );
  const [company, referrals, rewards, clients] = await Promise.all([
    getLogisticsCompany(companyId),
    listCompanyReferrals(companyId),
    listCompanyRewards(companyId),
    listClientsForReferral(companyId),
  ]);
  if (!company) notFound();

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        title="Partner growth network"
        description="Bring verified merchants into the platform. Rewards follow real deliveries and payments, never registrations alone."
      />

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-medium">Referral links</h2>
        <div className="mt-4">
          <ReferralForm companyId={companyId} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Attributed merchants</h2>
        {referrals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No referral links yet.</p>
        ) : (
          referrals.map((referral) => (
            <div
              key={referral.id}
              className="space-y-3 rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-medium">/{referral.code}</p>
                  <p className="text-sm">{referral.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {referral.clientName ?? "Unattributed"} · {referral.completedDeliveries}{" "}
                    completed delivery(ies)
                    {referral.clientVerified ? " · merchant verified" : ""}
                  </p>
                </div>
                <Badge tone={referral.status === "QUALIFIED" ? "success" : "neutral"}>
                  {referral.status}
                </Badge>
              </div>
              <RegisterReferralForm
                companyId={companyId}
                referralId={referral.id}
                clients={clients}
              />
              <AdvanceReferralForm
                companyId={companyId}
                referralId={referral.id}
                status={referral.status}
              />
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Eligible rewards</h2>
        <p className="text-xs text-muted-foreground">
          Volume milestone requires {QUALIFYING_DELIVERIES} completed deliveries and a genuine
          payment.
        </p>
        {rewards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rewards recorded yet.</p>
        ) : (
          rewards.map((reward) => (
            <div
              key={reward.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-5"
            >
              <div>
                <p className="font-medium">{reward.kind}</p>
                <p className="text-xs text-muted-foreground">
                  {reward.referralCode} · {reward.points} points
                  {reward.amount ? ` · ${reward.amount}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone={reward.status === "PAID" ? "success" : "neutral"}>
                  {reward.status}
                </Badge>
                {reward.status === "ELIGIBLE" ? (
                  <RewardStatusForm companyId={companyId} rewardId={reward.id} />
                ) : null}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
