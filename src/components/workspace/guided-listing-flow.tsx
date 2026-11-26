"use client";

import { ArrowLeft, ArrowRight, Check, Info } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { Field, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { saveProductAction } from "@/features/catalog/vendor-actions";
import { initialFormState } from "@/features/identity/form-state";
import { slugify } from "@/features/workspace/experience";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils/cn";

const TOTAL_STEPS = 4;
const DRAFT_KEY = "supplyhub_listing_draft_v1";

interface Draft {
  step: number;
  categoryId: string;
  name: string;
  description: string;
  price: string;
  stock: string;
  slug: string;
  makerNote: string;
}

const EMPTY_DRAFT: Draft = {
  step: 1,
  categoryId: "",
  name: "",
  description: "",
  price: "",
  stock: "1",
  slug: "",
  makerNote: "",
};

const PRICE_PATTERN = /^\d{1,9}(?:\.\d{1,2})?$/;

/**
 * "Sell something" in four short steps.
 *
 * One decision per screen, a visible back button, a progress bar, smart defaults
 * and a draft that survives a closed tab. Advanced fields stay behind a
 * disclosure; the last step is a review plus the real server action, so the
 * guidance never replaces validation or authorization.
 */
export function GuidedListingFlow({
  categories,
}: {
  categories: Array<{ id: string; name: string }>;
}) {
  const t = useT();
  const headingId = useId();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const stepRef = useRef<HTMLElement | null>(null);
  const firstStepRender = useRef(true);
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, formAction] = useActionState(saveProductAction, initialFormState);

  // The first paint must match the server, so the saved draft is applied right
  // after mount rather than during render (no hydration mismatch).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Draft>;
          setDraft((current) => ({
            ...current,
            ...parsed,
            step: Math.min(TOTAL_STEPS, Math.max(1, Number(parsed.step) || 1)),
          }));
          setRestored(true);
        }
      } catch {
        /* a corrupt or blocked draft must never stop the flow */
      }
      setHydrated(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* storage unavailable (private mode) — the flow still works in memory */
    }
  }, [draft, hydrated]);

  // Each step starts at its own heading: focus moves there for screen readers and
  // a phone does not land halfway down a longer screen.
  useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    stepRef.current?.focus({ preventScroll: false });
  }, [draft.step]);

  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const departmentName =
    categories.find((category) => category.id === draft.categoryId)?.name ??
    t("workspace.guide.reviewDepartment");

  const problemForStep = (step: number): string | null => {
    if (step === 1) {
      return draft.categoryId ? null : t("workspace.guide.required");
    }
    if (step === 2) {
      return draft.name.trim().length >= 2 && draft.description.trim().length >= 20
        ? null
        : t("workspace.guide.required");
    }
    if (step === 3) {
      if (!PRICE_PATTERN.test(draft.price.trim()) || Number(draft.price) <= 0) {
        return t("workspace.guide.invalidPrice");
      }
      const stock = Number(draft.stock);
      if (!Number.isInteger(stock) || stock < 0 || stock > 100000) {
        return t("workspace.guide.invalidStock");
      }
    }
    return null;
  };

  const goNext = () => {
    const problem = problemForStep(draft.step);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    update({ step: Math.min(TOTAL_STEPS, draft.step + 1) });
  };

  const goBack = () => {
    setError(null);
    update({ step: Math.max(1, draft.step - 1) });
  };

  const resolvedSlug = draft.slug.trim() || slugify(draft.name) || `listing-${draft.step}`;
  const stepLabel = t("workspace.guide.stepOf", { current: draft.step, total: TOTAL_STEPS });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[0.6875rem] tracking-[0.14em] text-muted-foreground uppercase">
            {stepLabel}
          </p>
          {restored ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="size-3.5 text-success" aria-hidden="true" />
              {t("workspace.guide.draftSaved")}
            </span>
          ) : null}
        </div>
        <div
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
          aria-valuenow={draft.step}
          aria-label={stepLabel}
          className="mt-2.5 flex gap-1.5"
        >
          {Array.from({ length: TOTAL_STEPS }, (_, index) => (
            <span
              key={index}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                index < draft.step ? "bg-accent" : "bg-border",
              )}
            />
          ))}
        </div>
      </div>

      <section
        ref={stepRef}
        tabIndex={-1}
        aria-labelledby={headingId}
        className="scroll-mt-24 space-y-5 focus:outline-none"
      >
        {draft.step === 1 ? (
          <>
            <div>
              <h2 id={headingId} className="font-display text-2xl font-medium tracking-[-0.02em]">
                {t("workspace.guide.step1Title")}
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                {t("workspace.guide.step1Body")}
              </p>
            </div>
            <p className="sr-only" aria-live="polite">
              {stepLabel}
            </p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {categories.map((category) => {
                const selected = draft.categoryId === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setError(null);
                      update({ categoryId: category.id });
                    }}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
                      selected
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border bg-surface hover:border-border-strong hover:bg-surface-muted",
                    )}
                  >
                    {category.name}
                    {selected ? <Check className="size-4" aria-hidden="true" /> : null}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        {draft.step === 2 ? (
          <>
            <div>
              <h2 id={headingId} className="font-display text-2xl font-medium tracking-[-0.02em]">
                {t("workspace.guide.step2Title")}
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                {t("workspace.guide.step2Body")}
              </p>
            </div>

            <Field
              label={t("workspace.guide.fieldName")}
              htmlFor="guide-name"
              hint={t("workspace.guide.fieldNameHint")}
            >
              <Input
                id="guide-name"
                value={draft.name}
                onChange={(event) => update({ name: event.target.value })}
                maxLength={120}
                autoComplete="off"
              />
            </Field>

            <Field
              label={t("workspace.guide.fieldDescription")}
              htmlFor="guide-description"
              hint={t("workspace.guide.fieldDescriptionHint")}
            >
              <Textarea
                id="guide-description"
                value={draft.description}
                onChange={(event) => update({ description: event.target.value })}
                maxLength={4000}
                className="min-h-32"
              />
            </Field>

            <details className="rounded-xl border border-border bg-surface px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                {t("workspace.guide.advanced")}
              </summary>
              <div className="mt-4 space-y-4">
                <Field
                  label={t("workspace.guide.fieldHandle")}
                  htmlFor="guide-slug"
                  hint={t("workspace.guide.fieldHandleHint")}
                >
                  <Input
                    id="guide-slug"
                    value={draft.slug}
                    onChange={(event) => update({ slug: event.target.value })}
                    placeholder={slugify(draft.name)}
                    spellCheck={false}
                  />
                </Field>
                <Field
                  label={t("workspace.guide.fieldMakerNote")}
                  htmlFor="guide-maker-note"
                  hint={t("workspace.guide.fieldMakerNoteHint")}
                >
                  <Textarea
                    id="guide-maker-note"
                    value={draft.makerNote}
                    onChange={(event) => update({ makerNote: event.target.value })}
                    maxLength={600}
                    className="min-h-20"
                  />
                </Field>
              </div>
            </details>
          </>
        ) : null}

        {draft.step === 3 ? (
          <>
            <div>
              <h2 id={headingId} className="font-display text-2xl font-medium tracking-[-0.02em]">
                {t("workspace.guide.step3Title")}
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                {t("workspace.guide.step3Body")}
              </p>
            </div>

            <Field
              label={t("workspace.guide.fieldPrice")}
              htmlFor="guide-price"
              hint={t("workspace.guide.fieldPriceHint")}
            >
              <Input
                id="guide-price"
                value={draft.price}
                onChange={(event) => update({ price: event.target.value })}
                inputMode="decimal"
                placeholder="1200"
              />
            </Field>
            <Help>{t("workspace.guide.helpPrice")}</Help>

            <Field
              label={t("workspace.guide.fieldStock")}
              htmlFor="guide-stock"
              hint={t("workspace.guide.fieldStockHint")}
            >
              <Input
                id="guide-stock"
                type="number"
                min={0}
                max={100000}
                step={1}
                value={draft.stock}
                onChange={(event) => update({ stock: event.target.value })}
              />
            </Field>
            <Help>{t("workspace.guide.helpQuantity")}</Help>
          </>
        ) : null}

        {draft.step === 4 ? (
          <>
            <div>
              <h2 id={headingId} className="font-display text-2xl font-medium tracking-[-0.02em]">
                {t("workspace.guide.step4Title")}
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                {t("workspace.guide.step4Body")}
              </p>
            </div>

            <p className="font-mono text-[0.6875rem] tracking-[0.14em] text-muted-foreground uppercase">
              {t("workspace.guide.reviewTitle")}
            </p>

            <dl className="divide-y divide-border rounded-xl border border-border bg-surface">
              <div className="flex items-baseline justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-muted-foreground">{t("workspace.guide.reviewName")}</dt>
                <dd className="text-sm font-medium">{draft.name.trim() || "—"}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-muted-foreground">
                  {t("workspace.guide.reviewDepartment")}
                </dt>
                <dd className="text-sm font-medium">{departmentName}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-muted-foreground">
                  {t("workspace.guide.reviewPrice")}
                </dt>
                <dd className="font-mono text-sm font-medium tabular-nums">
                  {draft.price} {t("workspace.guide.fieldPriceHint")}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-muted-foreground">
                  {t("workspace.guide.reviewStock")}
                </dt>
                <dd className="font-mono text-sm font-medium tabular-nums">{draft.stock}</dd>
              </div>
            </dl>

            <form action={formAction} className="space-y-5">
              <input type="hidden" name="name" value={draft.name} />
              <input type="hidden" name="slug" value={resolvedSlug} />
              <input type="hidden" name="categoryId" value={draft.categoryId} />
              <input type="hidden" name="description" value={draft.description} />
              <input type="hidden" name="price" value={draft.price} />
              <input type="hidden" name="initialStock" value={draft.stock} />
              <input type="hidden" name="makerNote" value={draft.makerNote} />

              <Field
                label={t("workspace.guide.fieldPhoto")}
                htmlFor="guide-photo"
                hint={t("workspace.guide.fieldPhotoHint")}
                error={state.fieldErrors?.image}
              >
                <Input
                  id="guide-photo"
                  name="image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  className="h-auto py-2.5"
                />
              </Field>

              <FormMessage state={state} />
              {state.fieldErrors
                ? Object.entries(state.fieldErrors)
                    .filter(([field]) => field !== "image")
                    .map(([field, message]) => (
                      <p key={field} className="text-sm text-danger">
                        {message}
                      </p>
                    ))
                : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  {t("workspace.guide.back")}
                </button>
                <SubmitButton
                  pendingLabel={t("workspace.guide.publishing")}
                  className="w-auto min-w-40"
                >
                  {t("workspace.guide.publish")}
                </SubmitButton>
              </div>
            </form>
          </>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        {draft.step < TOTAL_STEPS ? (
          <div className="flex flex-wrap items-center gap-3">
            {draft.step > 1 ? (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                {t("workspace.guide.back")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={goNext}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
            >
              {t("workspace.guide.next")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Help({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex gap-2 rounded-lg bg-surface-muted px-3 py-2.5 text-xs leading-5 text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
