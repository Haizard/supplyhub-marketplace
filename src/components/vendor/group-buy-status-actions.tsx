"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { activateCampaignAction, cancelCampaignAction } from "@/features/groupbuy/actions";
import { initialFormState } from "@/features/identity/form-state";
import type { GroupBuyStatus } from "@/generated/prisma/enums";
import { useT } from "@/i18n/client";

export function GroupBuyStatusActions({
  campaignId,
  status,
}: {
  campaignId: string;
  status: GroupBuyStatus;
}) {
  const t = useT();
  const [activateState, activate, activating] = useActionState(
    activateCampaignAction,
    initialFormState,
  );
  const [cancelState, cancel, cancelling] = useActionState(cancelCampaignAction, initialFormState);

  const message = activateState.message ?? cancelState.message;
  const failed = activateState.status === "error" || cancelState.status === "error";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "DRAFT" ? (
          <form action={activate}>
            <input type="hidden" name="campaignId" value={campaignId} />
            <Button type="submit" size="sm" variant="accent" disabled={activating}>
              {t("groupBuy.activate")}
            </Button>
          </form>
        ) : null}
        {(status === "DRAFT" || status === "ACTIVE") && (
          <form action={cancel}>
            <input type="hidden" name="campaignId" value={campaignId} />
            <Button type="submit" size="sm" variant="secondary" disabled={cancelling}>
              {t("groupBuy.cancelCampaign")}
            </Button>
          </form>
        )}
      </div>
      {message ? (
        <p className={failed ? "text-xs text-danger" : "text-xs text-success"}>{message}</p>
      ) : null}
    </div>
  );
}
