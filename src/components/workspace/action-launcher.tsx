"use client";

import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { workspaceIcon } from "@/components/workspace/icons";
import {
  createHintKey,
  type ExperienceId,
  type WorkspaceTask,
} from "@/features/workspace/experience";
import { useT } from "@/i18n/client";

/**
 * The universal Create action. One entry point anywhere in the workspace, but
 * the catalogue only ever lists tasks this role can actually start.
 */
export function ActionLauncher({
  actions,
  experience,
}: {
  actions: WorkspaceTask[];
  experience: ExperienceId;
}) {
  const t = useT();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft/60 px-4 py-4 text-left transition-colors hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none sm:px-5"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
            <Plus className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">
              {t("workspace.create.open")}
            </span>
            <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
              {t(createHintKey(experience))}
            </span>
          </span>
          <ArrowRight
            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </button>
      </DialogTrigger>

      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("workspace.create.title")}</DialogTitle>
          <DialogDescription>{t("workspace.create.body")}</DialogDescription>
        </DialogHeader>

        <ul className="mt-5 divide-y divide-border rounded-xl border border-border">
          {actions.map((action) => {
            const Icon = workspaceIcon(action.icon);
            return (
              <li key={action.id}>
                <DialogClose asChild>
                  <Link
                    href={action.href}
                    className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-muted text-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{t(action.labelKey)}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        {t(action.bodyKey)}
                      </span>
                    </span>
                    <ArrowRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </Link>
                </DialogClose>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
