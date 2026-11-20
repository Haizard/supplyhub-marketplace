"use client";

import { BarChart3, Calculator as CalculatorIcon, Minus, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { type ReactNode, useActionState, useMemo, useState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { CalculatorPanel } from "@/components/pos/calculator";
import { FormMessage } from "@/components/ui/form-message";
import { formatMoney } from "@/features/catalog/money";
import { cashChangeCents, lineTotalCents } from "@/features/pos/calculation";
import type { PosProduct } from "@/features/pos/queries";
import { recordSaleAction } from "@/features/pos/actions";
import type { FormState } from "@/features/identity/form-state";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils/cn";

const initial: FormState = { status: "idle" };

type Method = "CASH" | "MOBILE_MONEY" | "CARD" | "OTHER";

export interface ClosedSummary {
  expected: string;
  counted: string;
  difference: string;
  balanced: boolean;
  over: boolean;
}

interface SaleNotice {
  sold: string | null;
  closed: ClosedSummary | null;
}

interface CartLine {
  productId: string;
  variantId: string | null;
  quantity: number;
}

function lineKey(productId: string, variantId: string | null): string {
  return `${productId}:${variantId ?? ""}`;
}

export interface PosTerminalProps {
  products: PosProduct[];
  currency: string;
  cashierName: string;
  session: {
    registerName: string;
    openedAt: string | null;
    expectedCashCents: number;
    salesCount: number;
  } | null;
  today: { salesCount: number; salesTotal: string; cashTotal: string; expensesTotal: string };
  recentSales: {
    id: string;
    saleNumber: string;
    itemCount: number;
    total: string;
    time: string;
  }[];
  forms: { open: ReactNode; close: ReactNode; expense: ReactNode };
  locationName: string | null;
  canRecordExpenses: boolean;
  notices: SaleNotice;
}

export function PosTerminal({
  products,
  currency,
  locationName,
  cashierName,
  session,
  today,
  recentSales,
  forms,
  canRecordExpenses,
  notices,
}: PosTerminalProps) {
  const t = useT();
  const [state, action] = useActionState(recordSaleAction, initial);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<Method>("CASH");
  const [tendered, setTendered] = useState("");
  const [reference, setReference] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.categoryName))].sort(),
    [products],
  );

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((product) => {
      if (category && product.categoryName !== category) return false;
      if (!term) return true;
      return product.name.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term);
    });
  }, [products, category, search]);

  const cartRows = lines.flatMap((line) => {
    const product = products.find((item) => item.id === line.productId);
    if (!product) return [];
    const variant = line.variantId
      ? (product.variants.find((option) => option.id === line.variantId) ?? null)
      : null;
    if (line.variantId && !variant) return [];
    return [{ ...line, product, variant }];
  });

  const totalCents = cartRows.reduce(
    (total, row) =>
      total +
      (lineTotalCents(row.variant?.priceCents ?? row.product.priceCents, row.quantity) ?? 0),
    0,
  );
  const itemCount = cartRows.reduce((count, row) => count + row.quantity, 0);

  const tenderedCents = Number.parseFloat(tendered || "0") * 100;
  const changeCents =
    method === "CASH" && Number.isFinite(tenderedCents) && tenderedCents > 0
      ? cashChangeCents(totalCents, Math.round(tenderedCents))
      : null;

  function quantityFor(productId: string, variantId: string | null): number {
    const key = lineKey(productId, variantId);
    return lines.find((line) => lineKey(line.productId, line.variantId) === key)?.quantity ?? 0;
  }

  function availableFor(product: PosProduct, variantId: string | null): number {
    return variantId
      ? (product.variants.find((option) => option.id === variantId)?.stock ?? 0)
      : product.stock;
  }

  function addLine(product: PosProduct, variantId: string | null) {
    const key = lineKey(product.id, variantId);
    const existing = lines.find((line) => lineKey(line.productId, line.variantId) === key);

    if ((existing?.quantity ?? 0) + 1 > availableFor(product, variantId)) return;

    setLines((current) =>
      existing
        ? current.map((line) =>
            lineKey(line.productId, line.variantId) === key
              ? { ...line, quantity: line.quantity + 1 }
              : line,
          )
        : [...current, { productId: product.id, variantId, quantity: 1 }],
    );
  }

  function stepLine(productId: string, variantId: string | null, delta: number) {
    const key = lineKey(productId, variantId);

    setLines((current) =>
      current.flatMap((line) => {
        if (lineKey(line.productId, line.variantId) !== key) return [line];
        const product = products.find((item) => item.id === productId);
        const available = product ? availableFor(product, variantId) : line.quantity;
        const quantity = Math.min(line.quantity + delta, available);
        return quantity <= 0 ? [] : [{ ...line, quantity }];
      }),
    );
  }

  function removeLine(productId: string, variantId: string | null) {
    const key = lineKey(productId, variantId);
    setLines((current) =>
      current.filter((line) => lineKey(line.productId, line.variantId) !== key),
    );
  }

  const methods: Array<{ value: Method; label: string }> = [
    { value: "CASH", label: t("pos.cash") },
    { value: "MOBILE_MONEY", label: t("pos.mobileMoney") },
    { value: "CARD", label: t("pos.card") },
    { value: "OTHER", label: t("pos.other") },
  ];

  return (
    <div className="rounded-[30px] bg-[#11131d] p-2.5 shadow-[0_28px_70px_-30px_rgba(6,8,16,0.9)] sm:p-3.5">
      {notices.sold ? (
        <p
          role="status"
          className="mb-2 rounded-2xl bg-[#16352a] px-3 py-2 text-[11px] font-medium text-[#9ff0c4]"
        >
          {t("pos.soldNotice")} <span className="font-mono">{notices.sold}</span>
          <Link
            href={`/vendor/pos/sales/${encodeURIComponent(notices.sold)}`}
            className="ml-2 font-semibold underline underline-offset-2"
          >
            {t("pos.receiptOpen")}
          </Link>
        </p>
      ) : null}

      {notices.closed ? (
        <p
          role="status"
          className={cn(
            "mb-2 rounded-2xl px-3 py-2 text-[11px] font-medium",
            notices.closed.balanced ? "bg-[#16352a] text-[#9ff0c4]" : "bg-[#3a2c14] text-[#f5cf87]",
          )}
        >
          {t("pos.closedNotice", {
            expected: notices.closed.expected,
            counted: notices.closed.counted,
          })}{" "}
          {notices.closed.balanced
            ? t("pos.balanced")
            : t("pos.difference", {
                amount: notices.closed.difference,
                side: notices.closed.over ? t("pos.over") : t("pos.short"),
              })}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 px-1.5 pb-2.5 sm:gap-3">
        <span className="grid size-8 place-items-center rounded-xl bg-[#e8f0bd] text-sm font-black text-[#11131d]">
          S
        </span>
        <p className="text-sm font-semibold text-white">{t("pos.title")}</p>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium",
            session ? "bg-[#1f3b2f] text-[#8fe0b6]" : "bg-white/10 text-white/60",
          )}
        >
          <span
            className={cn("size-1.5 rounded-full", session ? "bg-[#4ade80]" : "bg-white/40")}
            aria-hidden="true"
          />
          {session ? t("pos.registerOpen") : t("pos.registerClosed")}
        </span>

        <label className="relative order-last flex w-full items-center md:order-none md:ml-auto md:w-auto">
          <Search
            className="pointer-events-none absolute left-3 size-3.5 text-white/40"
            aria-hidden="true"
          />
          <span className="sr-only">{t("pos.searchCatalog")}</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("pos.searchCatalog")}
            className="h-9 w-full rounded-full bg-white/8 pr-3 pl-9 text-xs text-white placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-[#e8f0bd]/50 focus-visible:outline-none md:w-48 lg:w-56"
          />
        </label>

        <span className="hidden items-center gap-2 rounded-full bg-white/8 py-1 pr-3 pl-1 text-white lg:inline-flex">
          <span className="grid size-7 place-items-center rounded-full bg-[#ded9f6] text-[10px] font-semibold text-[#2a2350]">
            {cashierName.slice(0, 2).toUpperCase()}
          </span>
          <span className="text-xs">{cashierName}</span>
        </span>

        <button
          type="button"
          onClick={() => setCalculatorOpen((open) => !open)}
          aria-expanded={calculatorOpen}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f0bd] px-3 py-1.5 text-xs font-semibold text-[#11131d] transition-colors hover:bg-[#f2f7cf]"
        >
          <CalculatorIcon className="size-3.5" aria-hidden="true" />
          {t("pos.calculator")}
        </button>

        <Link
          href="/vendor/pos/report"
          className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/15"
        >
          <BarChart3 className="size-3.5" aria-hidden="true" />
          {t("pos.report")}
        </Link>
      </div>

      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_20.5rem]">
        {/* Catalog panel */}
        <section className="flex min-w-0 flex-col rounded-[24px] bg-[linear-gradient(180deg,#eff4cd_0%,#e7efb8_100%)] p-3 text-[#1b1f16] sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[13px] font-semibold">{t("pos.orderLine")}</h2>

            <div className="flex items-center gap-1 rounded-full bg-white/55 p-1">
              {methods.slice(0, 3).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMethod(option.value)}
                  aria-pressed={method === option.value}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                    method === option.value
                      ? "bg-[#11131d] text-white"
                      : "text-[#4b5236] hover:bg-white/70",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <span className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-semibold text-[#4b5236]">
              {recentSales.length}
            </span>

            <div className="ml-auto flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-[#3f4630]">
              <span className="rounded-full bg-white/70 px-2 py-1">
                {t("pos.salesToday")} · {today.salesCount}
              </span>
              <span className="rounded-full bg-white/70 px-2 py-1 tabular-nums">
                {today.salesTotal}
              </span>
              <span className="rounded-full bg-white/70 px-2 py-1 tabular-nums">
                {t("pos.expensesToday")} · {today.expensesTotal}
              </span>
            </div>
          </div>

          <div className="scroll-x mt-3 flex min-w-0 gap-2 pb-1">
            {recentSales.length === 0 ? (
              <p className="rounded-2xl bg-white/55 px-3 py-2 text-[11px] text-[#5a6148]">
                {t("pos.noSales")}
              </p>
            ) : (
              recentSales.map((sale) => (
                <Link
                  key={sale.id}
                  href={`/vendor/pos/sales/${encodeURIComponent(sale.saleNumber)}`}
                  className="w-[9.5rem] shrink-0 rounded-2xl bg-white/85 p-2.5 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] transition-colors hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono text-[9px] tracking-[0.08em] text-[#8a9078] uppercase">
                      {sale.saleNumber.split("-").slice(-1)}
                    </p>
                    <span className="rounded-full bg-[#e9f7d6] px-1.5 py-0.5 text-[9px] font-medium text-[#3f6b32]">
                      {t("pos.paid")}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11px] font-semibold text-[#2a2f22]">
                    {sale.total}
                  </p>
                  <p className="mt-0.5 text-[9px] text-[#8a9078]">
                    {sale.itemCount} {t("pos.lines")} · {sale.time}
                  </p>
                  <p className="mt-1 text-[9px] font-semibold text-[#3f6b32]">
                    {t("pos.receiptOpen")} →
                  </p>
                </Link>
              ))
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-semibold">{t("pos.exploreCatalog")}</h3>
            {locationName ? (
              <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] text-[#4b5236]">
                {locationName}
              </span>
            ) : null}
            <div className="scroll-x flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCategory("")}
                aria-pressed={category === ""}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-medium whitespace-nowrap transition-colors",
                  category === ""
                    ? "bg-[#cfc7f2] text-[#241d47]"
                    : "bg-white/60 text-[#4b5236] hover:bg-white/85",
                )}
              >
                {t("pos.allCategories")}
              </button>
              {categories.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setCategory(name)}
                  aria-pressed={category === name}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-medium whitespace-nowrap transition-colors",
                    category === name
                      ? "bg-[#cfc7f2] text-[#241d47]"
                      : "bg-white/60 text-[#4b5236] hover:bg-white/85",
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
            <span className="ml-auto text-[10px] text-[#7c8368]">
              {visibleProducts.length === 1
                ? t("pos.itemsCountOne")
                : t("pos.itemsCount", { count: visibleProducts.length })}
            </span>
          </div>

          {products.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-white/70 px-3 py-2 text-[11px] text-[#5a6148]">
              {t("pos.noProducts")}
            </p>
          ) : (
            <div className="mt-2.5 grid flex-1 auto-rows-min grid-cols-1 content-start gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
              {visibleProducts.map((product) => {
                const quantity = quantityFor(product.id, null);
                const soldOut = product.stock <= 0;
                const hasOptions = product.variants.length > 0;

                return (
                  <article
                    key={product.id}
                    className="rounded-2xl bg-white/90 p-2 shadow-[0_1px_0_rgba(255,255,255,0.9)_inset]"
                  >
                    <div className="flex gap-2">
                      {product.imageSrc ? (
                        <Image
                          src={product.imageSrc}
                          alt=""
                          width={64}
                          height={64}
                          className="size-16 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-[#eef1de] text-[10px] text-[#8a9078]">
                          {product.sku.slice(0, 6)}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-1">
                          <span className="truncate text-[9px] tracking-[0.06em] text-[#8a9078] uppercase">
                            {product.categoryName}
                          </span>
                          <span className="shrink-0 text-[10px] font-semibold text-[#2a2f22]">
                            {formatMoney(product.priceCents, product.currency)}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[12px] leading-4 font-medium text-[#1b1f16]">
                          {product.name}
                        </p>
                        <p className="mt-0.5 text-[9px] text-[#8a9078]">
                          {soldOut ? t("pos.outOfStock") : `${product.stock} ${t("pos.inStock")}`}
                        </p>
                      </div>
                    </div>

                    {hasOptions ? (
                      <div className="mt-2 space-y-1">
                        {product.variants.map((option) => {
                          const optionQuantity = quantityFor(product.id, option.id);
                          const unavailable = option.stock <= 0;

                          return (
                            <div
                              key={option.id}
                              className="flex items-center justify-between gap-1 rounded-full bg-[#f1f3e5] px-2 py-0.5"
                            >
                              <span className="min-w-0 truncate text-[10px] font-medium text-[#3f4630]">
                                {option.name} · {formatMoney(option.priceCents, product.currency)}
                              </span>

                              {optionQuantity > 0 ? (
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => stepLine(product.id, option.id, -1)}
                                    aria-label={`${t("pos.removeFromSale")} ${product.name} ${option.name}`}
                                    className="grid size-5 place-items-center rounded-full bg-white text-[#3f4630] shadow-sm"
                                  >
                                    <Minus className="size-2.5" aria-hidden="true" />
                                  </button>
                                  <span className="w-4 text-center text-[10px] font-semibold tabular-nums">
                                    {optionQuantity}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={unavailable}
                                    onClick={() => addLine(product, option.id)}
                                    aria-label={`${t("pos.addToSale")} ${product.name} ${option.name}`}
                                    className="grid size-5 place-items-center rounded-full bg-[#11131d] text-white disabled:opacity-40"
                                  >
                                    <Plus className="size-2.5" aria-hidden="true" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={unavailable}
                                  onClick={() => addLine(product, option.id)}
                                  aria-label={`${t("pos.addToSale")} ${product.name} ${option.name}`}
                                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-medium text-[#3f4630] shadow-sm disabled:opacity-40"
                                >
                                  <Plus className="size-2.5" aria-hidden="true" />
                                  {unavailable ? t("pos.outOfStock") : t("pos.add")}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center justify-between gap-1">
                        {quantity > 0 ? (
                          <div className="flex items-center gap-1 rounded-full bg-[#f1f3e5] px-1 py-0.5">
                            <button
                              type="button"
                              onClick={() => stepLine(product.id, null, -1)}
                              aria-label={`${t("pos.removeFromSale")} ${product.name}`}
                              className="grid size-6 place-items-center rounded-full bg-white text-[#3f4630] shadow-sm"
                            >
                              <Minus className="size-3" aria-hidden="true" />
                            </button>
                            <span className="w-5 text-center text-[11px] font-semibold tabular-nums">
                              {quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => addLine(product, null)}
                              aria-label={`${t("pos.addToSale")} ${product.name}`}
                              className="grid size-6 place-items-center rounded-full bg-[#11131d] text-white"
                            >
                              <Plus className="size-3" aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={soldOut}
                            onClick={() => addLine(product, null)}
                            aria-label={`${t("pos.addToSale")} ${product.name}`}
                            className="inline-flex items-center gap-1 rounded-full bg-[#f1f3e5] px-2.5 py-1 text-[10px] font-medium text-[#3f4630] transition-colors hover:bg-[#e6ebd0] disabled:opacity-40"
                          >
                            <Plus className="size-3" aria-hidden="true" />
                            {t("pos.add")}
                          </button>
                        )}

                        {quantity > 0 ? (
                          <button
                            type="button"
                            onClick={() => removeLine(product.id, null)}
                            aria-label={`${t("pos.removeFromSale")} ${product.name}`}
                            className="grid size-6 place-items-center rounded-full text-[#8a9078] transition-colors hover:text-[#b3402f]"
                          >
                            <X className="size-3.5" aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
          <div className="mt-auto grid grid-cols-2 gap-2 pt-3 sm:grid-cols-4">
            {[
              {
                label: t("pos.salesToday"),
                value: `${today.salesCount}`,
                hint: today.salesTotal,
              },
              { label: t("pos.cashToday"), value: today.cashTotal },
              { label: t("pos.expensesToday"), value: today.expensesTotal },
              {
                label: t("pos.expectedCash"),
                value: session ? formatMoney(session.expectedCashCents, currency) : "—",
              },
            ].map((tile) => (
              <div key={tile.label} className="rounded-2xl bg-white/60 px-2.5 py-2">
                <p className="truncate text-[9px] tracking-[0.08em] text-[#7c8368] uppercase">
                  {tile.label}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-[#2a2f22] tabular-nums">
                  {tile.value}
                </p>
                {tile.hint ? (
                  <p className="text-[9px] text-[#8a9078] tabular-nums">{tile.hint}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {/* Order details panel */}
        <aside className="flex min-w-0 flex-col rounded-[24px] bg-[linear-gradient(180deg,#e6e1fa_0%,#dcd6f5_100%)] p-3 text-[#1b1730] sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-[13px] font-semibold">{t("pos.orderDetails")}</h2>
              <span className="mt-1 inline-block rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-medium text-[#4a4560]">
                {t("pos.draft")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setLines([]);
                setTendered("");
                setReference("");
              }}
              className="text-[10px] font-medium text-[#6b6486] underline-offset-2 hover:underline"
            >
              {t("pos.clear")}
            </button>
          </div>

          <div className="mt-3 rounded-2xl bg-white/75 p-2.5">
            {session ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold text-[#3f3a5c]">
                    {t("pos.registerOpen")} · {session.registerName}
                  </p>
                  {session.openedAt ? (
                    <span className="text-[9px] text-[#7a7397]">{session.openedAt}</span>
                  ) : null}
                </div>
                <p className="mt-1 text-[10px] text-[#4a4560]">
                  {t("pos.expectedCash")}:{" "}
                  <strong className="tabular-nums">
                    {formatMoney(session.expectedCashCents, currency)}
                  </strong>{" "}
                  · {session.salesCount} {t("pos.salesToday").toLowerCase()}
                </p>
                <details className="group mt-2">
                  <summary className="cursor-pointer list-none rounded-full bg-[#11131d] px-3 py-1.5 text-center text-[10px] font-semibold text-white [&::-webkit-details-marker]:hidden">
                    {t("pos.closeRegister")}
                  </summary>
                  <div className="mt-2 rounded-xl bg-white p-2.5 text-[#1b1730] [&_label]:text-[#1b1730]">
                    {forms.close}
                  </div>
                </details>
              </>
            ) : (
              <>
                <p className="text-[10px] font-semibold text-[#3f3a5c]">{t("pos.openTitle")}</p>
                <p className="mt-1 text-[10px] text-[#4a4560]">{t("pos.startSessionHint")}</p>
                <div className="mt-2 rounded-xl bg-white p-2.5 text-[#1b1730] [&_label]:text-[#1b1730]">
                  {forms.open}
                </div>
              </>
            )}
          </div>

          <form action={action} className="contents">
            <input
              type="hidden"
              name="items"
              value={JSON.stringify(
                lines.map((line) => ({
                  productId: line.productId,
                  variantId: line.variantId,
                  quantity: line.quantity,
                })),
              )}
            />
            <input type="hidden" name="method" value={method} />
            {method === "CASH" ? (
              <input type="hidden" name="tendered" value={tendered} />
            ) : (
              <input type="hidden" name="reference" value={reference} />
            )}

            <div className="mt-2.5 flex items-center gap-1 rounded-full bg-white/60 p-1">
              {methods.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMethod(option.value)}
                  aria-pressed={method === option.value}
                  className={cn(
                    "flex-1 rounded-full px-1 py-1 text-[9px] font-medium whitespace-nowrap transition-colors",
                    method === option.value
                      ? "bg-white text-[#241d47] shadow-sm"
                      : "text-[#5c5680]",
                  )}
                >
                  {option.value === "MOBILE_MONEY" ? t("pos.mobileShort") : option.label}
                </button>
              ))}
            </div>

            <div className="mt-1 flex items-center justify-between rounded-xl bg-white/55 px-2.5 py-1.5 text-[10px]">
              <span className="text-[#5c5680]">{t("pos.cashier")}</span>
              <span className="font-medium text-[#1b1730]">{cashierName}</span>
            </div>

            <div className="mt-2 flex items-center justify-between text-[10px] text-[#5c5680]">
              <span className="font-mono uppercase">
                {recentSales[0]?.saleNumber.split("-")[0] ?? "POS"}
              </span>
              <span>
                {itemCount === 1
                  ? t("pos.itemsCountOne")
                  : t("pos.itemsCount", { count: itemCount })}
              </span>
            </div>

            <div className="mt-2 min-h-20 space-y-1.5 overflow-y-auto pr-0.5">
              {cartRows.length === 0 ? (
                <p className="rounded-xl bg-white/50 px-3 py-4 text-center text-[10px] text-[#7a7397]">
                  {t("pos.cartEmpty")}
                </p>
              ) : (
                cartRows.map((row) => (
                  <div
                    key={lineKey(row.product.id, row.variantId)}
                    className="flex items-center gap-2 rounded-xl bg-white/80 p-1.5"
                  >
                    {row.product.imageSrc ? (
                      <Image
                        src={row.product.imageSrc}
                        alt=""
                        width={32}
                        height={32}
                        className="size-8 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="size-8 shrink-0 rounded-lg bg-[#eef1de]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium">{row.product.name}</p>
                      {row.variant ? (
                        <p className="truncate text-[9px] text-[#7a7397]">
                          {row.variant.name} · {row.variant.sku}
                        </p>
                      ) : null}
                      <div className="mt-0.5 flex items-center gap-1 rounded-full bg-[#f2f0fb] px-1 py-0.5">
                        <button
                          type="button"
                          onClick={() => stepLine(row.product.id, row.variantId, -1)}
                          aria-label={`${t("pos.removeFromSale")} ${row.product.name}`}
                          className="grid size-5 place-items-center rounded-full bg-white text-[#3f3a5c]"
                        >
                          <Minus className="size-2.5" aria-hidden="true" />
                        </button>
                        <span className="w-4 text-center text-[10px] font-semibold tabular-nums">
                          {row.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => addLine(row.product, row.variantId)}
                          aria-label={`${t("pos.addToSale")} ${row.product.name}`}
                          className="grid size-5 place-items-center rounded-full bg-white text-[#3f3a5c]"
                        >
                          <Plus className="size-2.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#e9e6f7] px-2 py-1 text-[10px] font-semibold tabular-nums">
                      {formatMoney(
                        (row.variant?.priceCents ?? row.product.priceCents) * row.quantity,
                        row.product.currency,
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(row.product.id, row.variantId)}
                      aria-label={`${t("pos.removeFromSale")} ${row.product.name}`}
                      className="grid size-5 place-items-center rounded-full text-[#8a83a6] transition-colors hover:text-[#b3402f]"
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-2.5 space-y-1 rounded-2xl bg-white/70 px-2.5 py-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-[#5c5680]">{t("pos.subtotal")}</span>
                <span className="font-semibold tabular-nums">
                  {formatMoney(totalCents, currency)}
                </span>
              </div>

              {method === "CASH" ? (
                <label className="flex items-center justify-between gap-2">
                  <span className="text-[#5c5680]">{t("pos.tendered")}</span>
                  <input
                    value={tendered}
                    onChange={(event) => setTendered(event.target.value)}
                    inputMode="decimal"
                    placeholder={formatMoney(totalCents, currency)}
                    className="h-7 w-24 rounded-full bg-white px-2 text-right text-[11px] tabular-nums shadow-sm focus-visible:ring-2 focus-visible:ring-[#b9b0e6] focus-visible:outline-none"
                  />
                </label>
              ) : (
                <label className="flex items-center justify-between gap-2">
                  <span className="text-[#5c5680]">{t("pos.reference")}</span>
                  <input
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    maxLength={80}
                    className="h-7 w-28 rounded-full bg-white px-2 text-right text-[11px] shadow-sm focus-visible:ring-2 focus-visible:ring-[#b9b0e6] focus-visible:outline-none"
                  />
                </label>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[#5c5680]">{t("pos.change")}</span>
                <span className="rounded-full bg-[#e9e6f7] px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                  {changeCents === null
                    ? formatMoney(0, currency)
                    : formatMoney(changeCents, currency)}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-white/80 pt-1.5">
                <span className="text-[10px] tracking-[0.12em] text-[#5c5680] uppercase">
                  {t("pos.total")}
                </span>
                <span className="text-[13px] font-bold tabular-nums">
                  {formatMoney(totalCents, currency)}
                </span>
              </div>
            </div>

            <FormMessage state={state} className="mt-2 text-[11px]" />

            <div className="mt-2">
              {cartRows.length === 0 || !session ? (
                <button
                  type="button"
                  disabled
                  className="h-11 w-full cursor-not-allowed rounded-full bg-[#11131d]/45 text-[12px] font-semibold text-white/70"
                >
                  {t("pos.completeSale")}
                </button>
              ) : (
                <SubmitButton
                  pendingLabel={t("pos.completePending")}
                  className="h-11 rounded-full bg-[#11131d] text-[12px] font-semibold text-[#e8f0bd] hover:bg-[#1c2032]"
                >
                  {t("pos.completeSale")}
                </SubmitButton>
              )}
            </div>
          </form>

          <details className="mt-2">
            <summary className="cursor-pointer list-none rounded-full border border-white/70 bg-white/55 px-3 py-1.5 text-center text-[10px] font-medium text-[#3f3a5c] [&::-webkit-details-marker]:hidden">
              + {t("pos.expenseTitle")}
            </summary>
            <div className="mt-2 rounded-xl bg-white p-2.5 text-[#1b1730] [&_label]:text-[#1b1730]">
              {canRecordExpenses ? (
                forms.expense
              ) : (
                <p className="text-[10px] text-[#4a4560]">{t("pos.expenseLocked")}</p>
              )}
            </div>
          </details>
        </aside>
      </div>

      {calculatorOpen ? <CalculatorPanel onClose={() => setCalculatorOpen(false)} /> : null}
    </div>
  );
}
