"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { inviteMemberAction } from "@/features/business/actions";
import { useT } from "@/i18n/client";
import type { FormState } from "@/features/identity/form-state";

interface Props {
  businessId: string;
  roles: { id: string; name: string; isSystem: boolean }[];
}

const initial: FormState = { status: "idle" };

export function InviteMemberForm({ businessId, roles }: Props) {
  const t = useT();
  const [state, action] = useActionState(inviteMemberAction, initial);

  // Exclude the owner system role from the invite dropdown.
  const assignableRoles = roles.filter((r) => !(r.isSystem && r.name === "owner"));

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="businessId" value={businessId} />

      <FormMessage state={state} />

      <Field
        label={t("business.members.emailLabel")}
        htmlFor="email"
        error={state.status === "error" ? state.fieldErrors?.email : undefined}
      >
        <Input id="email" name="email" type="email" required maxLength={254} />
      </Field>

      <Field
        label={t("business.members.roleLabel")}
        htmlFor="roleName"
        error={state.status === "error" ? state.fieldErrors?.roleName : undefined}
      >
        <Select id="roleName" name="roleName" required defaultValue="">
          <option value="">{t("business.members.chooseRole")}</option>
          {assignableRoles.map((r) => (
            <option key={r.id} value={r.name}>
              {r.name}
            </option>
          ))}
        </Select>
      </Field>

      <SubmitButton pendingLabel={t("business.members.invitePending")}>
        {t("business.members.invite")}
      </SubmitButton>
    </form>
  );
}
