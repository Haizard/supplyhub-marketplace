import { Warehouse } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { CreateWarehouseForm, SetDefaultWarehouseForm } from "@/components/vendor/warehouse-form";
import { listVendorWarehouses } from "@/features/inventory/warehouses";
import { getServerI18n } from "@/i18n/server";

/**
 * Locations manager shared by the inventory page (rendered inline at
 * `/vendor/inventory?view=locations`) and the standalone warehouses route.
 */
export async function WarehouseManager({ vendorId }: { vendorId: string }) {
  const [{ t }, warehouses] = await Promise.all([getServerI18n(), listVendorWarehouses(vendorId)]);

  return (
    <div className="space-y-5">
      <section aria-labelledby="warehouse-list-heading" className="min-w-0">
        <h2 id="warehouse-list-heading" className="sr-only">
          {t("inventory.locationsTitle")}
        </h2>

        {warehouses.length === 0 ? (
          <EmptyState
            icon={<Warehouse className="size-5" aria-hidden="true" />}
            title={t("inventory.emptyLocations")}
            description={t("inventory.locationsDescription")}
          />
        ) : (
          <ul className="space-y-3">
            {warehouses.map((warehouse) => (
              <li
                key={warehouse.id}
                className="rounded-xl border border-border bg-surface p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{warehouse.name}</h3>
                      {warehouse.isDefault ? (
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.625rem] font-medium text-accent">
                          {t("inventory.defaultLabel")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 font-mono text-[0.6875rem] tracking-[0.08em] text-muted-foreground uppercase">
                      {warehouse.code}
                    </p>
                    {warehouse.address ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">{warehouse.address}</p>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold tabular-nums">
                      {warehouse.units === 1
                        ? t("inventory.unitsOne")
                        : t("inventory.units", { count: warehouse.units })}
                    </p>
                    <p className="mt-0.5 text-[0.6875rem] text-muted-foreground">
                      {warehouse.productCount === 1
                        ? t("inventory.productsOne")
                        : t("inventory.products", { count: warehouse.productCount })}
                    </p>
                  </div>
                </div>

                {warehouse.isDefault ? (
                  <p className="mt-3 border-t border-border pt-3 text-[0.6875rem] leading-4 text-muted-foreground">
                    {t("inventory.defaultNote")}
                  </p>
                ) : (
                  <div className="mt-3 border-t border-border pt-2.5">
                    <SetDefaultWarehouseForm
                      warehouseId={warehouse.id}
                      label={t("inventory.setDefault")}
                      pendingLabel={t("inventory.settingDefault")}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <CreateWarehouseForm
          title={t("inventory.addTitle")}
          submitLabel={t("inventory.createAction")}
          pendingLabel={t("inventory.creating")}
        />
      </aside>
    </div>
  );
}
