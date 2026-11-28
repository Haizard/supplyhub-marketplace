import {
  Activity,
  Building2,
  ClipboardList,
  FileText,
  Gauge,
  LayoutDashboard,
  MapPin,
  PackageCheck,
  Plug,
  ReceiptText,
  Route,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface CompanySection {
  /** Stable identifier used for active state and the i18n key. */
  key: string;
  /** Path suffix after `/logistics/{companyId}`; empty for the overview. */
  suffix: string;
  icon: LucideIcon;
  /** Client-side registry name — components cannot cross the RSC boundary. */
  iconName: string;
}

export interface CompanySectionGroup {
  key: string;
  items: CompanySection[];
}

/**
 * The console is ordered the way a delivery company works: what is happening
 * now (overview), then the operating loop (dispatch → deliveries → fleet →
 * people), then commercial relationships, money and growth, and finally the
 * workspace settings that apply to the company as a whole.
 */
export const companySectionGroups: CompanySectionGroup[] = [
  {
    key: "overview",
    items: [
      { key: "overview", suffix: "", icon: LayoutDashboard, iconName: "layoutDashboard" },
      { key: "activity", suffix: "/activity", icon: Activity, iconName: "activity" },
    ],
  },
  {
    key: "operations",
    items: [
      { key: "dispatch", suffix: "/dispatch", icon: Route, iconName: "route" },
      { key: "jobs", suffix: "/jobs", icon: PackageCheck, iconName: "packageCheck" },
      { key: "optimize", suffix: "/optimize", icon: Gauge, iconName: "gauge" },
    ],
  },
  {
    key: "fleet",
    items: [
      { key: "fleet", suffix: "/fleet", icon: Truck, iconName: "truck" },
      { key: "drivers", suffix: "/drivers", icon: UserRound, iconName: "userRound" },
      { key: "branches", suffix: "/branches", icon: MapPin, iconName: "mapPin" },
    ],
  },
  {
    key: "commercial",
    items: [
      { key: "clients", suffix: "/clients", icon: Building2, iconName: "building2" },
      { key: "contracts", suffix: "/contracts", icon: FileText, iconName: "fileText" },
      { key: "invoices", suffix: "/invoices", icon: ReceiptText, iconName: "receiptText" },
      { key: "finance", suffix: "/finance", icon: Wallet, iconName: "wallet" },
    ],
  },
  {
    key: "growth",
    items: [
      {
        key: "opportunities",
        suffix: "/opportunities",
        icon: ClipboardList,
        iconName: "clipboardList",
      },
      { key: "referrals", suffix: "/referrals", icon: Sparkles, iconName: "sparkles" },
      { key: "sharing", suffix: "/sharing", icon: Share2, iconName: "share2" },
    ],
  },
  {
    key: "workspace",
    items: [
      { key: "members", suffix: "/members", icon: Users, iconName: "users" },
      { key: "roles", suffix: "/roles", icon: ShieldCheck, iconName: "shieldCheck" },
      { key: "integrations", suffix: "/integrations", icon: Plug, iconName: "plug" },
      { key: "profile", suffix: "/edit", icon: Building2, iconName: "building2" },
      { key: "settings", suffix: "/settings", icon: Settings, iconName: "settings" },
    ],
  },
];

export const companySections = companySectionGroups.flatMap((group) => group.items);

/** Longest matching suffix wins, so `/clients/{id}` highlights Clients. */
export function resolveActiveSection(pathname: string, companyId: string): string {
  const base = `/logistics/${companyId}`;
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  if (!rest || rest === "/") return "overview";

  const match = companySections
    .filter((section) => section.suffix && rest.startsWith(section.suffix))
    .sort((a, b) => b.suffix.length - a.suffix.length)[0];

  return match?.key ?? "";
}
