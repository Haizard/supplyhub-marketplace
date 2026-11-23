"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { dispatchOutboxAction } from "../actions";

export function DispatchOutboxButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await dispatchOutboxAction();
            setMessage(result.ok ? result.message : result.error);
          })
        }
      >
        Dispatch pending events
      </Button>
      {message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
    </div>
  );
}
