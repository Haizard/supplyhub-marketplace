"use client";

import { KeyRound, LogIn, ShieldCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { useI18n } from "@/i18n/client";

import {
  confirmTwoFactorSetupAction,
  disableTwoFactorAction,
  regenerateBackupCodesAction,
  startTwoFactorSetupAction,
  type SecurityActionResult,
} from "../actions";
import type { SecurityStatus, SignInEventView } from "../types";

type Feedback = { tone: "success" | "danger"; text: string };

function Section({
  icon,
  title,
  body,
  children,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-6 sm:p-8">
      <h2 className="flex items-center gap-2 font-display text-xl font-medium tracking-[-0.02em]">
        <span className="text-accent">{icon}</span>
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{body}</p>
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  );
}

export function SecuritySettings({
  initialStatus,
  initialSignInEvents,
}: {
  initialStatus: SecurityStatus;
  initialSignInEvents: SignInEventView[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [pending, startTransition] = useTransition();

  const methodLabels: Record<string, string> = {
    PASSWORD: t("securitySettings.methodPassword"),
    PASSWORD_TOTP: t("securitySettings.methodTotp"),
    PASSWORD_BACKUP_CODE: t("securitySettings.methodBackup"),
  };

  function run(
    operation: () => Promise<SecurityActionResult>,
    onSuccess?: (result: SecurityActionResult) => void,
  ) {
    startTransition(async () => {
      const result = await operation();
      setFeedback({ tone: result.ok ? "success" : "danger", text: result.message });

      if (result.ok) {
        onSuccess?.(result);
      }
    });
  }

  return (
    <div className="space-y-6">
      {feedback ? (
        <Notice tone={feedback.tone} className="mb-2">
          {feedback.text}
        </Notice>
      ) : null}

      <Section
        icon={<KeyRound className="size-5" />}
        title={t("securitySettings.twoFactor")}
        body={t("securitySettings.twoFactorBody")}
      >
        <p className="text-sm">
          <span className="font-medium">
            {status.twoFactorEnabled
              ? t("securitySettings.enabled")
              : t("securitySettings.disabled")}
          </span>
        </p>

        {setupSecret ? (
          <div className="rounded-lg border border-accent/30 bg-surface-muted p-4">
            <p className="text-sm font-medium">{t("securitySettings.setupIntro")}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("securitySettings.setupSecret")}
            </p>
            <p className="mt-1 rounded bg-surface px-3 py-2 font-mono text-sm break-all">
              {setupSecret}
            </p>
          </div>
        ) : null}

        {!status.twoFactorEnabled && !setupSecret ? (
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              run(startTwoFactorSetupAction, (result) => {
                setSetupSecret(result.secret ?? null);
                setBackupCodes(result.backupCodes ?? null);
              })
            }
          >
            {t("securitySettings.setUp")}
          </Button>
        ) : null}

        {setupSecret ? (
          <div className="space-y-4">
            <Field label={t("securitySettings.codeLabel")} htmlFor="setup-confirm-code">
              <Input
                id="setup-confirm-code"
                value={twoFactorCode}
                onChange={(event) => setTwoFactorCode(event.target.value)}
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={64}
                placeholder={t("securitySettings.codePlaceholder")}
              />
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={pending || twoFactorCode.trim().length === 0}
                onClick={() =>
                  run(
                    () => confirmTwoFactorSetupAction(twoFactorCode),
                    () => {
                      setStatus((current) => ({ ...current, twoFactorEnabled: true }));
                      setSetupSecret(null);
                      setTwoFactorCode("");
                    },
                  )
                }
              >
                {t("securitySettings.enable")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  setSetupSecret(null);
                  setBackupCodes(null);
                  setTwoFactorCode("");
                }}
              >
                {t("securitySettings.cancelSetup")}
              </Button>
            </div>
          </div>
        ) : null}

        {status.twoFactorEnabled ? (
          <div className="space-y-4">
            <Field label={t("securitySettings.codeLabel")} htmlFor="disable-two-factor-code">
              <Input
                id="disable-two-factor-code"
                value={twoFactorCode}
                onChange={(event) => setTwoFactorCode(event.target.value)}
                autoComplete="one-time-code"
                maxLength={64}
                placeholder={t("securitySettings.codePlaceholder")}
              />
            </Field>
            <Button
              type="button"
              variant="secondary"
              disabled={pending || twoFactorCode.trim().length === 0}
              onClick={() =>
                run(
                  () => disableTwoFactorAction(twoFactorCode),
                  () => {
                    setStatus((current) => ({
                      ...current,
                      twoFactorEnabled: false,
                      backupCodesRemaining: 0,
                    }));
                    setTwoFactorCode("");
                    router.push("/sign-in?signout=all");
                  },
                )
              }
            >
              {t("securitySettings.disable")}
            </Button>
          </div>
        ) : null}

        {backupCodes?.length ? (
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
            <p className="text-sm font-medium">{t("securitySettings.backupCodes")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("securitySettings.backupCodesBody")}
            </p>
            <ol className="mt-3 grid gap-1 font-mono text-sm sm:grid-cols-2">
              {backupCodes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ol>
            <Button
              type="button"
              variant="ghost"
              className="mt-4"
              disabled={pending}
              onClick={() => setBackupCodes(null)}
            >
              {t("securitySettings.done")}
            </Button>
          </div>
        ) : null}

        {status.twoFactorEnabled ? (
          <p className="text-sm text-muted-foreground">
            {t("securitySettings.remaining", { count: status.backupCodesRemaining })}
          </p>
        ) : null}

        {status.twoFactorEnabled && !backupCodes?.length ? (
          <div className="space-y-4">
            <Field label={t("securitySettings.codeLabel")} htmlFor="regenerate-backup-code">
              <Input
                id="regenerate-backup-code"
                value={twoFactorCode}
                onChange={(event) => setTwoFactorCode(event.target.value)}
                autoComplete="one-time-code"
                maxLength={64}
                placeholder={t("securitySettings.codePlaceholder")}
              />
            </Field>
            <Button
              type="button"
              variant="secondary"
              disabled={pending || twoFactorCode.trim().length === 0}
              onClick={() =>
                run(
                  () => regenerateBackupCodesAction(twoFactorCode),
                  (result) => {
                    setBackupCodes(result.backupCodes ?? null);
                    setTwoFactorCode("");
                    setStatus((current) => ({
                      ...current,
                      backupCodesRemaining:
                        result.backupCodes?.length ?? current.backupCodesRemaining,
                    }));
                  },
                )
              }
            >
              {t("securitySettings.regenerate")}
            </Button>
          </div>
        ) : null}
      </Section>

      <Section
        icon={<Smartphone className="size-5" />}
        title={t("securitySettings.phone")}
        body={t("securitySettings.phoneBody")}
      >
        <Notice tone="info">{t("securitySettings.phoneDisabled")}</Notice>
      </Section>

      <Section
        icon={<LogIn className="size-5" />}
        title={t("securitySettings.signInHistory")}
        body={t("securitySettings.signInHistoryBody")}
      >
        {initialSignInEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("securitySettings.noSignInEvents")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface-muted">
            {initialSignInEvents.map((event) => (
              <li key={event.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {event.device}
                    {event.newDevice ? (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[0.625rem] font-semibold text-accent">
                        {t("securitySettings.newDevice")}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{event.location}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {methodLabels[event.method] ?? event.method}
                  </p>
                </div>
                <time
                  className="shrink-0 text-xs text-muted-foreground"
                  dateTime={event.occurredAt}
                >
                  {new Date(event.occurredAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="size-4" />
        <Link href="/account" className="rounded-sm text-accent underline-offset-4 hover:underline">
          {t("securitySettings.backToAccount")}
        </Link>
      </p>
    </div>
  );
}
