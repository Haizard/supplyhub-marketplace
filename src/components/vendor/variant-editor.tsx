"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface VariantRowValue {
  id?: string;
  name: string;
  sku: string;
  price: string;
  stock: number;
}

interface EditableRow extends VariantRowValue {
  key: string;
}

function emptyRow(): EditableRow {
  return { key: crypto.randomUUID(), name: "", sku: "", price: "", stock: 0 };
}

export function VariantEditor({ defaultVariants = [] }: { defaultVariants?: VariantRowValue[] }) {
  const fieldId = useId();
  const [rows, setRows] = useState<EditableRow[]>(() =>
    defaultVariants.length > 0
      ? defaultVariants.map((variant) => ({ ...variant, key: variant.id ?? crypto.randomUUID() }))
      : [emptyRow()],
  );

  function updateRow(key: string, patch: Partial<EditableRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  return (
    <fieldset className="space-y-3 border-t border-border pt-8">
      <legend className="eyebrow text-muted-foreground">Options</legend>
      <p className="text-sm leading-6 text-muted-foreground">
        Sell the same object in sizes, colours, or materials. Each option has its own SKU, price,
        and stock, and the object&apos;s stock becomes the total of its options. Leave every row
        empty to sell a single version.
      </p>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div
            key={row.key}
            className="grid gap-2 rounded-lg border border-border bg-surface-muted/40 p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_auto]"
          >
            <input type="hidden" name="variantId" value={row.id ?? ""} />
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>Option</span>
              <Input
                aria-label={`Option ${index + 1} name`}
                name="variantName"
                value={row.name}
                onChange={(event) => updateRow(row.key, { name: event.target.value })}
                maxLength={60}
                placeholder="Sand / small"
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>SKU</span>
              <Input
                aria-label={`Option ${index + 1} SKU`}
                name="variantSku"
                value={row.sku}
                onChange={(event) => updateRow(row.key, { sku: event.target.value.toUpperCase() })}
                maxLength={32}
                spellCheck={false}
                placeholder={`${fieldId}-S`}
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>Price</span>
              <Input
                aria-label={`Option ${index + 1} price`}
                name="variantPrice"
                value={row.price}
                onChange={(event) => updateRow(row.key, { price: event.target.value })}
                inputMode="decimal"
                placeholder="68.00"
              />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>Stock</span>
              <Input
                aria-label={`Option ${index + 1} stock`}
                name="variantStock"
                type="number"
                min={0}
                max={100000}
                step={1}
                value={row.stock}
                onChange={(event) => updateRow(row.key, { stock: Number(event.target.value) })}
              />
            </label>
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove option ${index + 1}`}
                onClick={() =>
                  setRows((current) =>
                    current.length === 1
                      ? [emptyRow()]
                      : current.filter((entry) => entry.key !== row.key),
                  )
                }
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setRows((current) => [...current, emptyRow()])}
      >
        <Plus className="size-4" aria-hidden="true" />
        Add option
      </Button>
    </fieldset>
  );
}
