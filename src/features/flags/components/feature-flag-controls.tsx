"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { createFeatureFlagAction, setFeatureFlagEnabledAction } from "../actions";
import type { FeatureFlagView } from "../types";

const input =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-[#0f766e] focus:outline-none";

export function FeatureFlagToggle({ flag }: { flag: FeatureFlagView }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        size="sm"
        variant={flag.enabled ? "secondary" : "primary"}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setFeatureFlagEnabledAction({
              id: flag.id,
              enabled: !flag.enabled,
            });
            setMessage(result.ok ? result.message : result.error);
          })
        }
      >
        {flag.enabled ? "Disable" : "Enable"}
      </Button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}

export function FeatureFlagForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ key: "", name: "", description: "" });

  return (
    <form
      className="grid gap-3 rounded-xl border border-border bg-surface p-4"
      onSubmit={(event) => {
        event.preventDefault();
        setMessage("");
        startTransition(async () => {
          const result = await createFeatureFlagAction(form);
          setMessage(result.ok ? result.message : result.error);
          if (result.ok) setForm({ key: "", name: "", description: "" });
        });
      }}
    >
      <label className="block text-xs font-semibold text-muted-foreground">
        Key
        <Input
          className={input}
          value={form.key}
          onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))}
          placeholder="phase7.myFeature"
          required
        />
      </label>
      <label className="block text-xs font-semibold text-muted-foreground">
        Name
        <Input
          className={input}
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          required
        />
      </label>
      <label className="block text-xs font-semibold text-muted-foreground">
        Description
        <Input
          className={input}
          value={form.description}
          onChange={(event) =>
            setForm((current) => ({ ...current, description: event.target.value }))
          }
        />
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        Create flag
      </Button>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </form>
  );
}
