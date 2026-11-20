import type { Metadata } from "next";
import { ArrowLeft, Package, Plus, Search, Star, Warehouse } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductStatusBadge } from "@/components/vendor/product-status-badge";
import { WarehouseManager } from "@/components/vendor/warehouse-manager";
import { formatMoney } from "@/features/catalog/money";
import { LOW_STOCK_THRESHOLD, listStudioInventory } from "@/features/inventory/queries";
import { getServerI18n } from "@/i18n/server";
import { cn } from "@/lib/utils/cn";
import { requireStudioAccess } from "@/server/business/studio-access";

export const metadata: Metadata = {
  title: "Inventory",
  description: "Stock, prices, and visibility for every object in the studio.",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 8;

const FILTERS = ["all", "published", "low", "out"] as const;
const SORTS = ["updated", "stock", "price", "name"] as const;

type Filter = (typeof FILTERS)[number];
type Sort = (typeof SORTS)[number];

interface InventoryParams {
  q: string;
  filter: Filter;
  sort: Sort;
  category: string;
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilter(value: string | undefined): Filter {
  return FILTERS.find((entry) => entry === value) ?? "all";
}

function parseSort(value: string | undefined): Sort {
  return SORTS.find((entry) => entry === value) ?? "updated";
}

function parsePageNumber(value: string | undefined, pages: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  return Math.min(page, Math.max(1, pages));
}

function inventoryHref(params: InventoryParams, page: number): string {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.filter !== "all") query.set("filter", params.filter);
  if (params.sort !== "updated") query.set("sort", params.sort);
  if (params.category) query.set("category", params.category);
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return search ? `/vendor/inventory?${search}` : "/vendor/inventory";
}

function FilterChip({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count?: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "border-accent bg-accent-soft font-medium text-foreground"
          : "border-border text-muted-foreground hover:bg-surface-muted hover:text-foreground",
      )}
    >
      {label}
      {count === undefined ? null : (
        <span className="font-mono text-[0.625rem] tabular-nums">{count}</span>
      )}
    </Link>
  );
}

export default function StudioInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<InventorySkeleton />}>
      <InventoryContent searchParams={searchParams} />
    </Suspense>
  );
}

async function InventoryContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ vendorId }, params, { t }] = await Promise.all([
    requireStudioAccess("inventory.read", "/vendor/inventory"),
    searchParams,
    getServerI18n(),
  ]);

  const view = one(params.view) === "locations" ? "locations" : "objects";

  if (view === "locations") {
    return (
      <div className="max-w-5xl">
        <Link
          href="/vendor/inventory"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {t("inventory.filterAll")}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-[-0.03em] text-balance sm:text-[1.75rem]">
          {t("inventory.locationsTitle")}
        </h1>
        <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-[0.8125rem]">
          {t("inventory.locationsDescription")}
        </p>
        <div className="mt-4">
          <WarehouseManager vendorId={vendorId} />
        </div>
      </div>
    );
  }

  const inventory = await listStudioInventory(vendorId);

  const q = (one(params.q) ?? "").trim();
  const filter = parseFilter(one(params.filter));
  const sort = parseSort(one(params.sort));
  const category = (one(params.category) ?? "").trim();
  const term = q.toLowerCase();

  const filtered = inventory.rows.filter((row) => {
    if (filter === "published" && row.status !== "PUBLISHED") return false;
    if (filter === "low" && !(row.stock > 0 && row.stock <= LOW_STOCK_THRESHOLD)) return false;
    if (filter === "out" && row.stock > 0) return false;
    if (category && row.categoryName !== category) return false;
    if (!term) return true;
    return (
      row.name.toLowerCase().includes(term) ||
      row.sku.toLowerCase().includes(term) ||
      row.categoryName.toLowerCase().includes(term)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "stock") return a.stock - b.stock;
    if (sort === "price") return b.priceCents - a.priceCents;
    if (sort === "name") return a.name.localeCompare(b.name);
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = parsePageNumber(one(params.page), pages);
  const visible = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const maxStock = Math.max(1, ...sorted.map((row) => row.stock));
  const hrefParams: InventoryParams = { q, filter, sort, category };

  const counts = {
    all: inventory.rows.length,
    published: inventory.rows.filter((row) => row.status === "PUBLISHED").length,
    low: inventory.rows.filter((row) => row.stock > 0 && row.stock <= LOW_STOCK_THRESHOLD).length,
    out: inventory.rows.filter((row) => row.stock <= 0).length,
  };

  const categoryCounts = new Map<string, number>();
  for (const row of inventory.rows) {
    categoryCounts.set(row.categoryName, (categoryCounts.get(row.categoryName) ?? 0) + 1);
  }
  const categories = [...categoryCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const filterLinks: Array<{ value: Filter; label: string; count: number }> = [
    { value: "all", label: t("inventory.filterAll"), count: counts.all },
    { value: "published", label: t("inventory.filterPublished"), count: counts.published },
    { value: "low", label: t("inventory.filterLow"), count: counts.low },
    { value: "out", label: t("inventory.filterOut"), count: counts.out },
  ];

  const stats = [
    {
      label: t("inventory.statActive"),
      note: t("inventory.statActiveNote"),
      value: inventory.stats.active,
    },
    {
      label: t("inventory.statUnits"),
      note: t("inventory.statUnitsNote"),
      value: inventory.stats.units,
    },
    {
      label: t("inventory.statLow"),
      note: t("inventory.statLowNote"),
      value: inventory.stats.lowStock,
    },
    {
      label: t("inventory.statOut"),
      note: t("inventory.statOutNote"),
      value: inventory.stats.outOfStock,
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.03em] text-balance sm:text-[1.75rem]">
            {t("inventory.title")}
          </h1>
          <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-[0.8125rem]">
            {t("inventory.description")}
          </p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/vendor/inventory?view=locations">
            <Warehouse className="size-4" aria-hidden="true" />
            {t("inventory.locationsTitle")}
          </Link>
        </Button>
      </div>

      <form
        method="get"
        role="search"
        className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-2.5"
      >
        <label className="relative flex min-w-[12rem] flex-1 items-center">
          <Search
            className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="sr-only">{t("inventory.searchPlaceholder")}</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t("inventory.searchPlaceholder")}
            className="h-9 w-full rounded-lg bg-surface-muted pr-3 pl-9 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
        </label>

        <label className="flex items-center gap-2">
          <span className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
            {t("inventory.sortLabel")}
          </span>
          <select
            name="sort"
            defaultValue={sort}
            className="h-9 rounded-lg border border-border bg-surface px-2 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <option value="updated">{t("inventory.sortUpdated")}</option>
            <option value="stock">{t("inventory.sortStock")}</option>
            <option value="price">{t("inventory.sortPrice")}</option>
            <option value="name">{t("inventory.sortName")}</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="font-mono text-[0.625rem] tracking-[0.1em] text-muted-foreground uppercase">
            {t("inventory.filterLabel")}
          </span>
          <select
            name="filter"
            defaultValue={filter}
            className="h-9 rounded-lg border border-border bg-surface px-2 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <option value="all">{t("inventory.filterAll")}</option>
            <option value="published">{t("inventory.filterPublished")}</option>
            <option value="low">{t("inventory.filterLow")}</option>
            <option value="out">{t("inventory.filterOut")}</option>
          </select>
        </label>

        {category ? <input type="hidden" name="category" value={category} /> : null}

        <Button type="submit" size="sm">
          {t("inventory.apply")}
        </Button>

        <Button asChild size="sm">
          <Link href="/vendor/products/new">
            <Plus className="size-4" aria-hidden="true" />
            {t("inventory.newObject")}
          </Link>
        </Button>
      </form>

      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[0.625rem] tracking-[0.12em] text-muted-foreground uppercase">
            {t("inventory.sidebarCatalog")}
          </span>
          {filterLinks.map((entry) => (
            <FilterChip
              key={entry.value}
              href={inventoryHref({ q, filter: entry.value, sort, category: "" }, 1)}
              label={entry.label}
              count={entry.count}
              active={filter === entry.value && !category}
            />
          ))}
        </div>

        {categories.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[0.625rem] tracking-[0.12em] text-muted-foreground uppercase">
              {t("inventory.sidebarCategories")}
            </span>
            <FilterChip
              href={inventoryHref({ q, filter, sort, category: "" }, 1)}
              label={t("inventory.allCategories")}
              count={counts.all}
              active={!category}
            />
            {categories.map(([name, count]) => (
              <FilterChip
                key={name}
                href={inventoryHref({ q, filter, sort, category: name }, 1)}
                label={name}
                count={count}
                active={category === name}
              />
            ))}
          </div>
        ) : null}
      </div>

      <section className="mt-4" aria-labelledby="inventory-stats-heading">
        <h2
          id="inventory-stats-heading"
          className="font-mono text-[0.625rem] tracking-[0.12em] text-muted-foreground uppercase"
        >
          {t("inventory.statHeading")}
        </h2>
        <div className="mt-2 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-surface p-4">
              <p className="font-mono text-[0.625rem] tracking-[0.12em] text-muted-foreground uppercase">
                {stat.label}
              </p>
              <p className="mt-1.5 text-2xl font-semibold tracking-[-0.02em] tabular-nums">
                {stat.value}
              </p>
              <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">{stat.note}</p>
            </div>
          ))}
        </div>
      </section>

      {inventory.rows.length === 0 ? (
        <EmptyState
          icon={<Package className="size-5" aria-hidden="true" />}
          title={t("inventory.empty")}
          description={t("inventory.description")}
        >
          <Link
            href="/vendor/products/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t("inventory.newObject")}
          </Link>
        </EmptyState>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left font-mono text-[0.625rem] tracking-[0.12em] text-muted-foreground uppercase">
                  <th scope="col" className="px-4 py-3 font-normal">
                    {t("inventory.colObject")}
                  </th>
                  <th scope="col" className="px-4 py-3 font-normal">
                    {t("inventory.colRating")}
                  </th>
                  <th scope="col" className="px-4 py-3 font-normal">
                    {t("inventory.colStock")}
                  </th>
                  <th scope="col" className="px-4 py-3 font-normal">
                    {t("inventory.colPrice")}
                  </th>
                  <th scope="col" className="px-4 py-3 font-normal">
                    {t("inventory.colStatus")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-normal">
                    {t("inventory.colActions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const low = row.stock > 0 && row.stock <= LOW_STOCK_THRESHOLD;
                  const out = row.stock <= 0;
                  const width = Math.max(4, Math.round((row.stock / maxStock) * 100));

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-border last:border-b-0 hover:bg-surface-muted"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Image
                            src={row.image?.src ?? "/images/demo/placeholder.jpg"}
                            alt={row.image?.alt ?? ""}
                            width={44}
                            height={44}
                            className="size-11 shrink-0 rounded-lg object-cover"
                          />
                          <div className="min-w-0">
                            <Link
                              href={`/vendor/products/${row.id}`}
                              className="block truncate font-medium underline-offset-4 hover:underline"
                            >
                              {row.name}
                            </Link>
                            <p className="mt-0.5 truncate font-mono text-[0.625rem] tracking-[0.08em] text-muted-foreground uppercase">
                              {row.sku} · {row.categoryName}
                            </p>
                            {row.optionCount > 0 ? (
                              <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
                                {row.optionCount === 1
                                  ? t("inventory.optionsCountOne")
                                  : t("inventory.optionsCount", { count: row.optionCount })}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top">
                        {row.ratingAverage === null ? (
                          <span className="text-xs text-muted-foreground">
                            {t("inventory.noRating")}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Star
                              className="size-3.5 fill-current text-[#b58a2b]"
                              aria-hidden="true"
                            />
                            <span className="font-medium tabular-nums">
                              {row.ratingAverage.toFixed(1)}
                            </span>
                            <span className="text-[0.6875rem] text-muted-foreground tabular-nums">
                              · {row.ratingCount}
                            </span>
                          </div>
                        )}
                        <p className="mt-1 text-[0.6875rem] text-muted-foreground tabular-nums">
                          {t("inventory.soldCount", { count: row.sold })}
                        </p>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <p
                          className={
                            out
                              ? "font-semibold text-[#b3402f] tabular-nums"
                              : low
                                ? "font-semibold text-[#b45309] tabular-nums"
                                : "font-semibold tabular-nums"
                          }
                        >
                          {out ? t("inventory.filterOut") : row.stock}
                        </p>
                        <div
                          className="mt-1.5 h-1 w-20 overflow-hidden rounded-full bg-surface-muted"
                          aria-hidden="true"
                        >
                          <div
                            className={
                              out
                                ? "h-full rounded-full bg-[#b3402f]"
                                : low
                                  ? "h-full rounded-full bg-[#b45309]"
                                  : "h-full rounded-full bg-accent"
                            }
                            style={{ width: out ? "100%" : `${width}%` }}
                          />
                        </div>
                        {inventory.locationName && row.atDefaultLocation !== null ? (
                          <p className="mt-1 text-[0.6875rem] text-muted-foreground tabular-nums">
                            {t("inventory.atLocation", {
                              count: row.atDefaultLocation,
                              location: inventory.locationName,
                            })}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-4 py-3 align-top font-medium whitespace-nowrap tabular-nums">
                        {formatMoney(row.priceCents, row.currency)}
                      </td>

                      <td className="px-4 py-3 align-top">
                        <ProductStatusBadge status={row.status} />
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <Button asChild variant="secondary" size="sm">
                            <Link href={`/vendor/products/${row.id}`}>{t("inventory.edit")}</Link>
                          </Button>
                          {row.status === "PUBLISHED" ? (
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/products/${row.slug}`} target="_blank" rel="noreferrer">
                                {t("inventory.view")}
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {visible.length === 0 ? (
            <p className="mt-4 rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
              {t("inventory.noResults")}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[0.625rem] tracking-[0.12em] text-muted-foreground uppercase">
              {sorted.length === 1
                ? t("inventory.resultsCountOne")
                : t("inventory.resultsCount", { count: sorted.length })}
            </p>

            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={inventoryHref(hrefParams, page - 1)} rel="prev">
                    {t("common.previous")}
                  </Link>
                </Button>
              ) : (
                <Button variant="secondary" size="sm" disabled>
                  {t("common.previous")}
                </Button>
              )}
              <span className="text-xs text-muted-foreground tabular-nums">
                {t("products.page", { page, pages })}
              </span>
              {page < pages ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={inventoryHref(hrefParams, page + 1)} rel="next">
                    {t("common.next")}
                  </Link>
                </Button>
              ) : (
                <Button variant="secondary" size="sm" disabled>
                  {t("common.next")}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function InventorySkeleton() {
  return (
    <div role="status" aria-label="Loading inventory">
      <Skeleton className="h-7 w-36" />
      <Skeleton className="mt-2 h-3.5 w-72 max-w-full" />
      <Skeleton className="mt-4 h-14 rounded-xl" />
      <div className="mt-3 flex gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-6 w-24 rounded-full" />
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-16 rounded-xl" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
