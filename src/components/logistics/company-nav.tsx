import Link from "next/link";

import { cn } from "@/lib/utils/cn";

const links = [
  { key: "overview", label: "Overview", suffix: "" },
  { key: "profile", label: "Profile", suffix: "/edit" },
  { key: "branches", label: "Branches", suffix: "/branches" },
  { key: "fleet", label: "Fleet", suffix: "/fleet" },
  { key: "drivers", label: "Drivers", suffix: "/drivers" },
  { key: "clients", label: "Clients", suffix: "/clients" },
  { key: "contracts", label: "Contracts", suffix: "/contracts" },
  { key: "invoices", label: "Invoices", suffix: "/invoices" },
  { key: "dispatch", label: "Dispatch", suffix: "/dispatch" },
  { key: "jobs", label: "Jobs", suffix: "/jobs" },
  { key: "members", label: "Members", suffix: "/members" },
  { key: "roles", label: "Roles", suffix: "/roles" },
  { key: "settings", label: "Settings", suffix: "/settings" },
  { key: "activity", label: "Activity", suffix: "/activity" },
] as const;

export function CompanyNav({
  companyId,
  active,
}: {
  companyId: string;
  active: (typeof links)[number]["key"];
}) {
  return (
    <nav aria-label="Company sections" className="flex flex-wrap gap-1 border-b border-border pb-2">
      {links.map((link) => (
        <Link
          key={link.key}
          href={`/logistics/${companyId}${link.suffix}`}
          aria-current={active === link.key ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            active === link.key
              ? "bg-accent-soft font-medium text-foreground"
              : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
