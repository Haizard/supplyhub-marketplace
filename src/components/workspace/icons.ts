import {
  BarChart3,
  CircleUserRound,
  Compass,
  House,
  LayoutGrid,
  MessageSquare,
  Package,
  Plus,
  Receipt,
  ShoppingBag,
  Store,
  Truck,
  Users,
  Wallet,
  Clock,
  Heart,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

import type { WorkspaceIcon } from "@/features/workspace/experience";

const ICONS: Record<WorkspaceIcon, LucideIcon> = {
  create: Plus,
  receipt: Receipt,
  package: Package,
  truck: Truck,
  wallet: Wallet,
  users: Users,
  chart: BarChart3,
  bag: ShoppingBag,
  message: MessageSquare,
  heart: Heart,
  list: ListChecks,
  store: Store,
  home: House,
  compass: Compass,
  activity: Clock,
  more: LayoutGrid,
};

export function workspaceIcon(name: WorkspaceIcon): LucideIcon {
  return ICONS[name] ?? CircleUserRound;
}
