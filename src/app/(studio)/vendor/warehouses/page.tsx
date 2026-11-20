import { redirect } from "next/navigation";

// Locations now render inside the inventory page, beside its own sidebar,
// so old bookmarks keep working without leaving the inventory shell.
export default function WarehousesPage() {
  redirect("/vendor/inventory?view=locations");
}
