"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { initialFormState } from "@/features/identity/form-state";
import { requestAgricultureAdviceAction } from "@/features/agriculture/assistant-actions";

export function AgricultureAssistantForm() {
  const [state, action, pending] = useActionState(requestAgricultureAdviceAction, initialFormState);
  return (
    <form action={action} className="space-y-3">
      <Field label="Your question" htmlFor="assistantQuestion" error={state.fieldErrors?.question}>
        <Input
          id="assistantQuestion"
          name="question"
          placeholder="Nina ekari mbili za mahindi..."
          maxLength={500}
          required
        />
      </Field>
      <Field label="Language" htmlFor="assistantLanguage" error={state.fieldErrors?.language}>
        <Select id="assistantLanguage" name="language" defaultValue="en">
          <option value="en">English</option>
          <option value="sw">Kiswahili</option>
        </Select>
      </Field>
      <Button type="submit" variant="accent" disabled={pending}>
        Generate advisory answer
      </Button>
      {state.message ? (
        <p className={state.status === "error" ? "text-xs text-danger" : "text-xs text-success"}>
          {state.message}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Advisory only. Questions are stripped of emails, phone numbers and links before any model
        call.
      </p>
    </form>
  );
}
