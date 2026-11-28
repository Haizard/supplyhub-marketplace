import {
  Building2,
  FileText,
  Handshake,
  Layers,
  Package,
  Sparkles,
  Sprout,
  Store,
  Tractor,
  Truck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface AgricultureSection {
  key: string;
  href: string;
  icon: LucideIcon;
  /** Client-side registry name — components cannot cross the RSC boundary. */
  iconName: string;
}

export interface AgricultureSectionGroup {
  key: string;
  items: AgricultureSection[];
}

/**
 * The agriculture console follows the work: what the farm is doing now, the
 * records behind it, who it trades with, what it buys, and how produce moves.
 */
export const agricultureSectionGroups: AgricultureSectionGroup[] = [
  {
    key: "overview",
    items: [
      {
        key: "farmer",
        href: "/agriculture/farmer",
        icon: Sprout,
        iconName: "sprout",
      },
      {
        key: "assistant",
        href: "/agriculture/assistant",
        icon: Sparkles,
        iconName: "sparkles",
      },
    ],
  },
  {
    key: "farm",
    items: [
      {
        key: "farm-management",
        href: "/agriculture/farm-management",
        icon: Layers,
        iconName: "layers",
      },
      { key: "groups", href: "/agriculture/groups", icon: Users, iconName: "users" },
      { key: "contracts", href: "/agriculture/contracts", icon: FileText, iconName: "fileText" },
    ],
  },
  {
    key: "trade",
    items: [
      { key: "buyers", href: "/agriculture/buyers", icon: Handshake, iconName: "handshake" },
      { key: "marketplace", href: "/agriculture/marketplace", icon: Store, iconName: "store" },
    ],
  },
  {
    key: "supply",
    items: [
      { key: "services", href: "/agriculture/services", icon: Tractor, iconName: "tractor" },
      { key: "inputs", href: "/agriculture/inputs", icon: Package, iconName: "package" },
      { key: "suppliers", href: "/agriculture/suppliers", icon: Building2, iconName: "building2" },
    ],
  },
  {
    key: "logistics",
    items: [{ key: "logistics", href: "/agriculture/logistics", icon: Truck, iconName: "truck" }],
  },
];
