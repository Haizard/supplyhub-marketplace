"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  createPurchaseOrderAction,
  createQuotationAction,
  createRfqAction,
  payInvoiceAction,
  saveWholesaleListingAction,
} from "@/features/b2b/actions";
import { initialFormState, type FormState } from "@/features/identity/form-state";
import { useT } from "@/i18n/client";

type ActionFn = (prev: FormState, formData: FormData) => Promise<FormState>;
type ButtonVariant = "primary" | "secondary" | "accent" | "ghost" | "link";

function FormFeedback({ state }: { state: FormState }) {
  if (state.status === "idle") return null;
  const firstError = state.fieldErrors ? Object.values(state.fieldErrors)[0] : undefined;
  const message = state.message ?? firstError;
  if (!message) return null;
  return (
    <p className="text-xs text-muted-foreground" aria-live="polite">
      {message}
    </p>
  );
}

interface RfqItemRow {
  productName: string;
  sku: string;
  quantity: string;
  targetPrice: string;
}

interface PoItemRow {
  productName: string;
  sku: string;
  quantity: string;
  unitPrice: string;
}

const emptyRfqRow = (): RfqItemRow => ({
  productName: "",
  sku: "",
  quantity: "1",
  targetPrice: "",
});
const emptyPoRow = (): PoItemRow => ({ productName: "", sku: "", quantity: "1", unitPrice: "" });

export function RfqForm({
  businessId,
  suppliers,
}: {
  businessId: string;
  suppliers: { id: string; name: string }[];
}) {
  const t = useT();
  const [state, action, pending] = useActionState(createRfqAction, initialFormState);
  const [rows, setRows] = useState<RfqItemRow[]>([emptyRfqRow()]);

  function update(index: number, key: keyof RfqItemRow, value: string) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  const items = rows.map((row) => ({
    productName: row.productName,
    sku: row.sku || undefined,
    quantity: row.quantity,
    targetPrice: row.targetPrice || undefined,
  }));

  return (
    <form action={action} className="space-y-5 rounded-xl border border-border bg-surface p-5">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("b2b.supplier")} htmlFor="rfq-supplier">
          <Select id="rfq-supplier" name="supplierVendorId" required defaultValue="">
            <option value="" disabled>
              —
            </option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("b2b.currency")} htmlFor="rfq-currency">
          <Input id="rfq-currency" name="currency" defaultValue="TZS" maxLength={3} required />
        </Field>
        <Field label={t("b2b.targetDate")} htmlFor="rfq-target">
          <Input id="rfq-target" name="targetDate" type="date" />
        </Field>
      </div>

      <Field label={t("b2b.note")} htmlFor="rfq-note">
        <Textarea id="rfq-note" name="note" maxLength={1000} />
      </Field>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{t("b2b.items")}</h3>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setRows((current) => [...current, emptyRfqRow()])}
            disabled={rows.length >= 50}
          >
            {t("b2b.addItem")}
          </Button>
        </div>
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-lg border border-border bg-surface-muted/40 p-3 sm:grid-cols-[2fr_1fr_0.7fr_1fr_auto]"
          >
            <Field label={t("b2b.product")} htmlFor={`rfq-product-${index}`}>
              <Input
                id={`rfq-product-${index}`}
                value={row.productName}
                onChange={(event) => update(index, "productName", event.target.value)}
                required
              />
            </Field>
            <Field label={t("b2b.sku")} htmlFor={`rfq-sku-${index}`}>
              <Input
                id={`rfq-sku-${index}`}
                value={row.sku}
                onChange={(event) => update(index, "sku", event.target.value)}
              />
            </Field>
            <Field label={t("b2b.quantity")} htmlFor={`rfq-qty-${index}`}>
              <Input
                id={`rfq-qty-${index}`}
                type="number"
                min={1}
                step={1}
                value={row.quantity}
                onChange={(event) => update(index, "quantity", event.target.value)}
                required
              />
            </Field>
            <Field label={t("b2b.targetPrice")} htmlFor={`rfq-price-${index}`}>
              <Input
                id={`rfq-price-${index}`}
                inputMode="decimal"
                value={row.targetPrice}
                onChange={(event) => update(index, "targetPrice", event.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="self-end"
              onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
              disabled={rows.length === 1}
            >
              {t("b2b.removeItem")}
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {t("b2b.sendRfq")}
        </Button>
        <FormFeedback state={state} />
      </div>
    </form>
  );
}

export function QuotationForm({
  rfqId,
  currency,
  items,
}: {
  rfqId: string;
  currency: string;
  items: { id: string; productName: string; sku: string | null; quantity: number }[];
}) {
  const t = useT();
  const [state, action, pending] = useActionState(createQuotationAction, initialFormState);
  const [rows, setRows] = useState(
    items.map((item) => ({
      rfqItemId: item.id,
      quantity: String(item.quantity),
      unitPrice: "",
      note: "",
    })),
  );

  function update(index: number, key: "quantity" | "unitPrice" | "note", value: string) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  return (
    <form action={action} className="space-y-5 rounded-xl border border-border bg-surface p-5">
      <input type="hidden" name="rfqId" value={rfqId} />
      <input type="hidden" name="items" value={JSON.stringify(rows)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("b2b.currency")} htmlFor="quote-currency">
          <Input
            id="quote-currency"
            name="currency"
            defaultValue={currency}
            maxLength={3}
            required
          />
        </Field>
        <Field label={t("b2b.validUntil")} htmlFor="quote-valid">
          <Input id="quote-valid" name="validUntil" type="date" />
        </Field>
      </div>
      <Field label={t("b2b.note")} htmlFor="quote-note">
        <Textarea id="quote-note" name="note" maxLength={1000} />
      </Field>
      <ul className="space-y-3">
        {items.map((item, index) => (
          <li
            key={item.id}
            className="grid gap-3 rounded-lg border border-border bg-surface-muted/40 p-3 sm:grid-cols-[2fr_0.7fr_1fr_1fr]"
          >
            <div>
              <p className="text-sm font-medium">{item.productName}</p>
              <p className="font-mono text-xs text-muted-foreground">{item.sku ?? "—"}</p>
            </div>
            <Field label={t("b2b.quantity")} htmlFor={`quote-qty-${index}`}>
              <Input
                id={`quote-qty-${index}`}
                type="number"
                min={1}
                step={1}
                value={rows[index]!.quantity}
                onChange={(event) => update(index, "quantity", event.target.value)}
                required
              />
            </Field>
            <Field label={t("b2b.unitPrice")} htmlFor={`quote-price-${index}`}>
              <Input
                id={`quote-price-${index}`}
                inputMode="decimal"
                value={rows[index]!.unitPrice}
                onChange={(event) => update(index, "unitPrice", event.target.value)}
                placeholder="0.00"
                required
              />
            </Field>
            <Field label={t("b2b.note")} htmlFor={`quote-item-note-${index}`}>
              <Input
                id={`quote-item-note-${index}`}
                value={rows[index]!.note}
                onChange={(event) => update(index, "note", event.target.value)}
                maxLength={500}
              />
            </Field>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || rows.length === 0}>
          {t("b2b.sendQuotation")}
        </Button>
        <FormFeedback state={state} />
      </div>
    </form>
  );
}

export function PurchaseOrderForm({
  businessId,
  suppliers,
  quotations,
}: {
  businessId: string;
  suppliers: { id: string; name: string }[];
  quotations: { id: string; quotationNumber: string; supplierName: string }[];
}) {
  const t = useT();
  const [state, action, pending] = useActionState(createPurchaseOrderAction, initialFormState);
  const [rows, setRows] = useState<PoItemRow[]>([emptyPoRow()]);

  function update(index: number, key: keyof PoItemRow, value: string) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  const items = rows.map((row) => ({
    productName: row.productName,
    sku: row.sku || undefined,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
  }));

  return (
    <form action={action} className="space-y-5 rounded-xl border border-border bg-surface p-5">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("b2b.supplier")} htmlFor="po-supplier">
          <Select id="po-supplier" name="supplierVendorId" required defaultValue="">
            <option value="" disabled>
              —
            </option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("b2b.quotations")} htmlFor="po-quotation">
          <Select id="po-quotation" name="quotationId" defaultValue="">
            <option value="">—</option>
            {quotations.map((quote) => (
              <option key={quote.id} value={quote.id}>
                {quote.quotationNumber} · {quote.supplierName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("b2b.currency")} htmlFor="po-currency">
          <Input id="po-currency" name="currency" defaultValue="TZS" maxLength={3} required />
        </Field>
        <Field label={t("b2b.tax")} htmlFor="po-tax">
          <Input id="po-tax" name="tax" inputMode="decimal" defaultValue="0" />
        </Field>
        <Field label={t("b2b.shipping")} htmlFor="po-shipping">
          <Input id="po-shipping" name="shipping" inputMode="decimal" defaultValue="0" />
        </Field>
      </div>
      <Field label={t("b2b.note")} htmlFor="po-note">
        <Textarea id="po-note" name="note" maxLength={1000} />
      </Field>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">{t("b2b.items")}</h3>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setRows((current) => [...current, emptyPoRow()])}
            disabled={rows.length >= 50}
          >
            {t("b2b.addItem")}
          </Button>
        </div>
        {rows.map((row, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-lg border border-border bg-surface-muted/40 p-3 sm:grid-cols-[2fr_1fr_0.7fr_1fr_auto]"
          >
            <Field label={t("b2b.product")} htmlFor={`po-product-${index}`}>
              <Input
                id={`po-product-${index}`}
                value={row.productName}
                onChange={(event) => update(index, "productName", event.target.value)}
                required
              />
            </Field>
            <Field label={t("b2b.sku")} htmlFor={`po-sku-${index}`}>
              <Input
                id={`po-sku-${index}`}
                value={row.sku}
                onChange={(event) => update(index, "sku", event.target.value)}
              />
            </Field>
            <Field label={t("b2b.quantity")} htmlFor={`po-qty-${index}`}>
              <Input
                id={`po-qty-${index}`}
                type="number"
                min={1}
                step={1}
                value={row.quantity}
                onChange={(event) => update(index, "quantity", event.target.value)}
                required
              />
            </Field>
            <Field label={t("b2b.unitPrice")} htmlFor={`po-price-${index}`}>
              <Input
                id={`po-price-${index}`}
                inputMode="decimal"
                value={row.unitPrice}
                onChange={(event) => update(index, "unitPrice", event.target.value)}
                placeholder="0.00"
                required
              />
            </Field>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="self-end"
              onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
              disabled={rows.length === 1}
            >
              {t("b2b.removeItem")}
            </Button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {t("b2b.sendPo")}
        </Button>
        <FormFeedback state={state} />
      </div>
    </form>
  );
}

export function WholesaleListingForm({
  vendorId,
  products,
}: {
  vendorId: string;
  products: { id: string; name: string; sku: string }[];
}) {
  const t = useT();
  const [state, action, pending] = useActionState(saveWholesaleListingAction, initialFormState);

  return (
    <form action={action} className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <input type="hidden" name="vendorId" value={vendorId} />
      <h3 className="text-sm font-semibold">{t("b2b.listings")}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("b2b.product")} htmlFor="wl-product">
          <Select id="wl-product" name="productId" defaultValue="">
            <option value="">—</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("b2b.sku")} htmlFor="wl-sku">
          <Input id="wl-sku" name="sku" maxLength={80} required />
        </Field>
        <Field label={t("b2b.product")} htmlFor="wl-title">
          <Input id="wl-title" name="title" minLength={2} maxLength={150} required />
        </Field>
        <Field label={t("b2b.currency")} htmlFor="wl-currency">
          <Input id="wl-currency" name="currency" defaultValue="TZS" maxLength={3} required />
        </Field>
        <Field label={t("b2b.unitPrice")} htmlFor="wl-price">
          <Input id="wl-price" name="unitPrice" inputMode="decimal" placeholder="0.00" required />
        </Field>
        <Field label={t("b2b.minimumOrder")} htmlFor="wl-min">
          <Input
            id="wl-min"
            name="minimumOrder"
            type="number"
            min={1}
            step={1}
            defaultValue={1}
            required
          />
        </Field>
        <Field label={t("b2b.stock")} htmlFor="wl-stock">
          <Input
            id="wl-stock"
            name="stockAvailable"
            type="number"
            min={0}
            step={1}
            defaultValue={0}
            required
          />
        </Field>
        <Field label={t("b2b.leadTime")} htmlFor="wl-lead">
          <Input
            id="wl-lead"
            name="leadTimeDays"
            type="number"
            min={0}
            max={365}
            step={1}
            defaultValue={7}
            required
          />
        </Field>
        <Field label={`${t("b2b.tiers")} — ${t("b2b.quantity")}`} htmlFor="wl-tier-min">
          <Input id="wl-tier-min" name="tierMin" type="number" min={1} step={1} />
        </Field>
        <Field label={`${t("b2b.tiers")} — ${t("b2b.unitPrice")}`} htmlFor="wl-tier-price">
          <Input id="wl-tier-price" name="tierPrice" inputMode="decimal" placeholder="0.00" />
        </Field>
      </div>
      <Field label={t("b2b.tiers")} htmlFor="wl-tier-max" hint={t("b2b.quantity")}>
        <Input id="wl-tier-max" name="tierMax" type="number" min={1} step={1} />
      </Field>
      <Field label={t("b2b.note")} htmlFor="wl-description">
        <Textarea id="wl-description" name="description" maxLength={2000} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {t("b2b.saveListing")}
        </Button>
        <FormFeedback state={state} />
      </div>
    </form>
  );
}

export function ActionButton({
  action,
  hidden,
  label,
  variant = "primary",
  withNote = false,
}: {
  action: ActionFn;
  hidden: Record<string, string>;
  label: string;
  variant?: ButtonVariant;
  withNote?: boolean;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="space-y-2">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {withNote ? <Input name="note" maxLength={500} placeholder={t("b2b.note")} /> : null}
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {label}
      </Button>
      <FormFeedback state={state} />
    </form>
  );
}

export function PaymentForm({
  businessId,
  invoiceId,
  balance,
}: {
  businessId: string;
  invoiceId: string;
  balance: string;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(payInvoiceAction, initialFormState);
  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3"
    >
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <Field label={t("b2b.amountPaid")} htmlFor="invoice-payment">
        <Input
          id="invoice-payment"
          name="amount"
          inputMode="decimal"
          defaultValue={balance}
          required
        />
      </Field>
      <Button type="submit" size="sm" disabled={pending}>
        {t("b2b.recordPayment")}
      </Button>
      <FormFeedback state={state} />
    </form>
  );
}
