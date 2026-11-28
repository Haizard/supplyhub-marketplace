import type { Metadata } from "next";

import {
  FarmerGroupForm,
  GroupMemberForm,
  HarvestDeliveryForm,
  AcceptAgreementForm,
} from "@/components/agriculture/group-forms";
import { ConsolePageHeader } from "@/components/console/console-ui";
import { isFeatureEnabled } from "@/features/flags/service";
import { getFarmerSummary } from "@/features/agriculture/queries";
import {
  listAllFarmers,
  listFarmerGroups,
  listHarvestAgreements,
} from "@/features/agriculture/group-queries";
import { requireActor } from "@/server/auth/guards";

export const metadata: Metadata = {
  title: "Farmer groups",
  robots: { index: false, follow: false },
};

export default async function FarmerGroupsPage() {
  const actor = await requireActor("/agriculture/groups");
  const enabled = await isFeatureEnabled("phase11.agricultureNetwork");
  const [farmer, farmers] = await Promise.all([getFarmerSummary(actor.id), listAllFarmers()]);
  const groups = farmer ? await listFarmerGroups(farmer.id) : [];
  const direct = farmer ? await listHarvestAgreements({ farmerId: farmer.id }) : [];
  const grouped = await Promise.all(
    groups.map((group) => listHarvestAgreements({ groupId: group.id })),
  );
  const agreements = [...direct, ...grouped.flat()];

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        title="Farmer groups"
        description="Cooperatives aggregate supply, negotiate bulk prices and receive harvest agreements."
      />
      {!enabled ? (
        <p className="rounded-lg border border-border bg-surface-muted p-4 text-sm text-muted-foreground">
          The agriculture network is not enabled yet.
        </p>
      ) : null}

      {farmer ? <FarmerGroupForm /> : null}
      {farmer && groups.length > 0 ? (
        <section className="rounded-xl border border-border bg-surface p-6">
          <h2 className="font-display text-lg font-medium">Group members</h2>
          <div className="mt-4">
            <GroupMemberForm
              groups={groups.map((group) => ({ id: group.id, name: group.name }))}
              farmers={farmers}
            />
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">My groups</h2>
        {groups.map((group) => (
          <p key={group.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
            {group.name} · {group.groupCode} · {group.memberCount} member(s) · coordinator{" "}
            {group.coordinatorName}
          </p>
        ))}
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No groups yet.</p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-lg font-medium">Harvest agreements</h2>
        {agreements.map((agreement) => (
          <div
            key={agreement.id}
            className="space-y-2 rounded-lg border border-border bg-surface p-3 text-sm"
          >
            <p>
              {agreement.agreementNumber} · {agreement.cropName} · {agreement.expectedQuantity}{" "}
              {agreement.unit}
              {agreement.groupName ? ` · group ${agreement.groupName}` : ""} · {agreement.status}
            </p>
            {agreement.deliveredQuantity ? (
              <p className="text-xs text-muted-foreground">
                Delivered {agreement.deliveredQuantity} {agreement.unit} · variance{" "}
                {agreement.varianceKg} kg
              </p>
            ) : null}
            {agreement.status === "PENDING_FARMER" ? (
              <AcceptAgreementForm agreementId={agreement.id} />
            ) : null}
            {agreement.status === "ACCEPTED" ? (
              <HarvestDeliveryForm agreementId={agreement.id} />
            ) : null}
          </div>
        ))}
        {agreements.length === 0 ? (
          <p className="text-sm text-muted-foreground">No harvest agreements.</p>
        ) : null}
      </section>
    </div>
  );
}
