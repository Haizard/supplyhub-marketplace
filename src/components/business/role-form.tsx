"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { createRoleAction, updateRoleAction } from "@/features/business/actions";
import type { FormState } from "@/features/identity/form-state";
import { useT } from "@/i18n/client";

interface PermissionOption {
  permissionKey: string;
  description: string;
}

interface Props {
  businessId: string;
  permissions: PermissionOption[];
  role?: { id: string; name: string; permissionKeys: string[] };
}

const initial: FormState = { status: "idle" };

export function RoleForm({ businessId, permissions, role }: Props) {
  const t = useT();
  const [state, action] = useActionState(role ? updateRoleAction : createRoleAction, initial);
  const granted = new Set(role?.permissionKeys ?? []);
  const idSuffix = role?.id ?? "new";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="businessId" value={businessId} />
      {role ? <input type="hidden" name="roleId" value={role.id} /> : null}

      <FormMessage state={state} />

      <Field
        label={t("business.roles.nameLabel")}
        htmlFor={`role-name-${idSuffix}`}
        error={state.status === "error" ? state.fieldErrors?.name : undefined}
      >
        <Input
          id={`role-name-${idSuffix}`}
          name="name"
          defaultValue={role?.name ?? ""}
          maxLength={50}
          required
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">
          {t("business.roles.permissionsLabel")}
        </legend>
        <p className="text-xs leading-5 text-muted-foreground">
          {t("business.roles.choosePermissions")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {permissions.map((permission) => (
            <label
              key={permission.permissionKey}
              className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-xs transition-colors hover:border-border-strong"
            >
              <input
                type="checkbox"
                name="permissionKeys"
                value={permission.permissionKey}
                defaultChecked={granted.has(permission.permissionKey)}
                className="mt-0.5 size-3.5 accent-accent"
              />
              <span className="min-w-0">
                <span className="block font-mono text-[0.6875rem]">{permission.permissionKey}</span>
                <span className="block text-muted-foreground">{permission.description}</span>
              </span>
            </label>
          ))}
        </div>
        {state.status === "error" && state.fieldErrors?.permissionKeys ? (
          <p className="text-sm text-danger">{state.fieldErrors.permissionKeys}</p>
        ) : null}
      </fieldset>

      <SubmitButton
        pendingLabel={role ? t("business.roles.updatePending") : t("business.roles.createPending")}
      >
        {role ? t("business.roles.update") : t("business.roles.create")}
      </SubmitButton>
    </form>
  );
}
