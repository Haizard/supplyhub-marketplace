"use client";

import { useActionState } from "react";

import { Field, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/features/identity/form-state";
import { saveReviewAction } from "@/features/reviews/actions";
import { useT } from "@/i18n/client";

export function ReviewForm({
  productId,
  existing,
}: {
  productId: string;
  existing: { rating: number; title: string; body: string } | null;
}) {
  const t = useT();
  const [state, action] = useActionState(saveReviewAction, initialFormState);
  const errors = state.fieldErrors;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />
      <FormMessage state={state} />

      <div className="grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <Field label={t("reviews.rating")} htmlFor="review-rating" error={errors?.rating}>
          <select
            id="review-rating"
            name="rating"
            defaultValue={String(existing?.rating ?? 5)}
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value} / 5
              </option>
            ))}
          </select>
        </Field>

        <Field label={t("reviews.titleLabel")} htmlFor="review-title" error={errors?.title}>
          <Input
            id="review-title"
            name="title"
            required
            maxLength={80}
            defaultValue={existing?.title}
          />
        </Field>
      </div>

      <Field label={t("reviews.bodyLabel")} htmlFor="review-body" error={errors?.body}>
        <Textarea
          id="review-body"
          name="body"
          required
          rows={4}
          maxLength={1200}
          defaultValue={existing?.body}
        />
      </Field>

      <SubmitButton
        pendingLabel={t("reviews.saving")}
        className="w-auto px-5"
        size="sm"
        variant="secondary"
      >
        {existing ? t("reviews.submitEdit") : t("reviews.submit")}
      </SubmitButton>
    </form>
  );
}
