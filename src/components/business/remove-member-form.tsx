"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { removeMemberAction } from "@/features/business/actions";
import type { FormState } from "@/features/identity/form-state";
import { useT } from "@/i18n/client";

interface Props {
  businessId: string;
  memberId: string;
}

const initial: FormState = { status: "idle" };

export function RemoveMemberForm({ businessId, memberId }: Props) {
  const t = useT();
  const [state, action] = useActionState(removeMemberAction, initial);

  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="businessId" value={businessId} />
        <input type="hidden" name="memberId" value={memberId} />
        <SubmitButton
          pendingLabel={t("business.members.removePending")}
          variant="ghost"
          size="sm"
          className="w-auto"
        >
          {t("business.members.remove")}
        </SubmitButton>
      </form>
      <FormMessage state={state} />
    </div>
  );
}
