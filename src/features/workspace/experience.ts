/**
 * Progressive Simplicity experience rules.
 *
 * This module is deliberately pure: it turns "who is this person and what can
 * they do" into the small set of user-facing tasks, actions and navigation
 * items for their current role. Nothing here grants permissions — the server
 * still authorizes every request — it only decides what the interface offers.
 *
 * Labels are i18n keys, never English strings, so the same rules drive all five
 * locales.
 */

export const EXPERIENCES = ["seller", "buyer", "courier"] as const;

export type ExperienceId = (typeof EXPERIENCES)[number];

export interface ExperienceAvailability {
  seller: boolean;
  buyer: boolean;
  courier: boolean;
}

export type WorkspaceIcon =
  | "create"
  | "receipt"
  | "package"
  | "truck"
  | "wallet"
  | "users"
  | "chart"
  | "bag"
  | "message"
  | "heart"
  | "list"
  | "store"
  | "home"
  | "compass"
  | "activity"
  | "more";

export interface WorkspaceTask {
  id: string;
  labelKey: string;
  bodyKey: string;
  href: string;
  icon: WorkspaceIcon;
}

export interface WorkspaceNavItem {
  id: string;
  labelKey: string;
  href: string;
  icon: WorkspaceIcon;
}

/**
 * One identity, several experiences. A person who sells and also buys sees the
 * seller view first but can switch without a second account.
 */
export function availableExperiences(availability: ExperienceAvailability): ExperienceId[] {
  const offered = EXPERIENCES.filter((experience) => availability[experience]);
  return offered.length > 0 ? offered : ["buyer"];
}

/** Reads `?as=` and only honours a view this person actually has. */
export function resolveExperience(
  requested: string | string[] | undefined,
  available: readonly ExperienceId[],
): ExperienceId {
  const value = Array.isArray(requested) ? requested[0] : requested;
  if (typeof value === "string" && (available as readonly string[]).includes(value)) {
    return value as ExperienceId;
  }
  return available[0] ?? "buyer";
}

const SELLER_TASKS: WorkspaceTask[] = [
  {
    id: "sell",
    labelKey: "workspace.tasks.sell",
    bodyKey: "workspace.tasks.sellBody",
    href: "/workspace/sell",
    icon: "create",
  },
  {
    id: "record-sale",
    labelKey: "workspace.tasks.recordSale",
    bodyKey: "workspace.tasks.recordSaleBody",
    href: "/vendor/pos",
    icon: "receipt",
  },
  {
    id: "prepare-orders",
    labelKey: "workspace.tasks.prepareOrders",
    bodyKey: "workspace.tasks.prepareOrdersBody",
    href: "/vendor/orders",
    icon: "package",
  },
  {
    id: "my-money",
    labelKey: "workspace.tasks.myMoney",
    bodyKey: "workspace.tasks.myMoneyBody",
    href: "/vendor/earnings",
    icon: "wallet",
  },
];

const BUYER_TASKS: WorkspaceTask[] = [
  {
    id: "buy",
    labelKey: "workspace.tasks.buy",
    bodyKey: "workspace.tasks.buyBody",
    href: "/products",
    icon: "bag",
  },
  {
    id: "my-orders",
    labelKey: "workspace.tasks.myOrders",
    bodyKey: "workspace.tasks.myOrdersBody",
    href: "/account/orders",
    icon: "package",
  },
  {
    id: "messages",
    labelKey: "workspace.tasks.messages",
    bodyKey: "workspace.tasks.messagesBody",
    href: "/messages",
    icon: "message",
  },
  {
    id: "saved",
    labelKey: "workspace.tasks.saved",
    bodyKey: "workspace.tasks.savedBody",
    href: "/account/wishlist",
    icon: "heart",
  },
];

const COURIER_TASKS: WorkspaceTask[] = [
  {
    id: "my-deliveries",
    labelKey: "workspace.tasks.myDeliveries",
    bodyKey: "workspace.tasks.myDeliveriesBody",
    href: "/courier",
    icon: "truck",
  },
  {
    id: "my-earnings",
    labelKey: "workspace.tasks.myEarnings",
    bodyKey: "workspace.tasks.myEarningsBody",
    href: "/courier",
    icon: "wallet",
  },
  {
    id: "messages",
    labelKey: "workspace.tasks.messages",
    bodyKey: "workspace.tasks.messagesBody",
    href: "/messages",
    icon: "message",
  },
];

/** The four (or three) things this person most likely opened the app to do. */
export function tasksFor(experience: ExperienceId): WorkspaceTask[] {
  if (experience === "seller") return SELLER_TASKS;
  if (experience === "courier") return COURIER_TASKS;
  return BUYER_TASKS;
}

/**
 * The universal Create catalogue. The same launcher serves every role; only the
 * actions that make sense for the active experience are listed.
 */
export function actionsFor(experience: ExperienceId): WorkspaceTask[] {
  if (experience === "seller") {
    return [
      SELLER_TASKS[0]!,
      SELLER_TASKS[1]!,
      {
        id: "arrange-delivery",
        labelKey: "workspace.actions.arrangeDelivery",
        bodyKey: "workspace.actions.arrangeDeliveryBody",
        href: "/delivery/request",
        icon: "truck",
      },
      {
        id: "add-customer",
        labelKey: "workspace.actions.addCustomer",
        bodyKey: "workspace.actions.addCustomerBody",
        href: "/vendor/customers",
        icon: "users",
      },
      {
        id: "group-buy",
        labelKey: "workspace.actions.groupBuy",
        bodyKey: "workspace.actions.groupBuyBody",
        href: "/vendor/group-buy/new",
        icon: "store",
      },
    ];
  }

  if (experience === "courier") {
    return [
      COURIER_TASKS[0]!,
      {
        id: "messages",
        labelKey: "workspace.tasks.messages",
        bodyKey: "workspace.tasks.messagesBody",
        href: "/messages",
        icon: "message",
      },
    ];
  }

  return [
    BUYER_TASKS[0]!,
    {
      id: "request-quantities",
      labelKey: "workspace.actions.requestQuantities",
      bodyKey: "workspace.actions.requestQuantitiesBody",
      href: "/b2b/rfq/new",
      icon: "list",
    },
    {
      id: "arrange-delivery",
      labelKey: "workspace.actions.arrangeDelivery",
      bodyKey: "workspace.actions.arrangeDeliveryBody",
      href: "/delivery/request",
      icon: "truck",
    },
    {
      id: "message-seller",
      labelKey: "workspace.actions.messageSeller",
      bodyKey: "workspace.actions.messageSellerBody",
      href: "/messages",
      icon: "message",
    },
  ];
}

/**
 * The Create card describes the active catalogue, so a buyer never reads a
 * seller's examples.
 */
export function createHintKey(experience: ExperienceId): string {
  if (experience === "seller") return "workspace.create.hintSeller";
  if (experience === "courier") return "workspace.create.hintCourier";
  return "workspace.create.hintBuyer";
}

/** Five destinations at most, so a phone screen never needs a menu maze. */
export function navFor(experience: ExperienceId): WorkspaceNavItem[] {
  const activitiesHref =
    experience === "seller"
      ? "/vendor/orders"
      : experience === "courier"
        ? "/courier"
        : "/account/orders";
  const messagesHref = experience === "seller" ? "/vendor/messages" : "/messages";

  return [
    { id: "home", labelKey: "workspace.nav.home", href: "/workspace", icon: "home" },
    { id: "explore", labelKey: "workspace.nav.explore", href: "/products", icon: "compass" },
    {
      id: "activities",
      labelKey: "workspace.nav.activities",
      href: activitiesHref,
      icon: "activity",
    },
    { id: "messages", labelKey: "workspace.nav.messages", href: messagesHref, icon: "message" },
    { id: "more", labelKey: "workspace.nav.more", href: "/account", icon: "more" },
  ];
}

export interface AttentionInput {
  ordersToPrepare: number;
  paymentsDue: number;
  lowStock: number;
  unreadMessages: number;
  activeDeliveries: number;
  buyerOpenOrders: number;
  savedProducts: number;
}

export interface AttentionItem {
  id: string;
  labelKey: string;
  bodyKey: string;
  count: number;
  href: string;
  tone: "warning" | "info";
}

/**
 * "What needs my attention" — urgent, role-relevant items only. Empty means the
 * home screen says so instead of inventing busywork.
 */
export function buildAttention(experience: ExperienceId, input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (experience === "seller") {
    if (input.ordersToPrepare > 0) {
      items.push({
        id: "orders",
        labelKey: "workspace.attention.orders",
        bodyKey: "workspace.attention.ordersBody",
        count: input.ordersToPrepare,
        href: "/vendor/orders",
        tone: "warning",
      });
    }
    if (input.paymentsDue > 0) {
      items.push({
        id: "payments",
        labelKey: "workspace.attention.due",
        bodyKey: "workspace.attention.dueBody",
        count: input.paymentsDue,
        href: "/vendor/earnings",
        tone: "warning",
      });
    }
    if (input.lowStock > 0) {
      items.push({
        id: "stock",
        labelKey: "workspace.attention.stock",
        bodyKey: "workspace.attention.stockBody",
        count: input.lowStock,
        href: "/vendor/inventory",
        tone: "info",
      });
    }
    if (input.unreadMessages > 0) {
      items.push({
        id: "messages",
        labelKey: "workspace.attention.messages",
        bodyKey: "workspace.attention.messagesBody",
        count: input.unreadMessages,
        href: "/vendor/messages",
        tone: "info",
      });
    }
    return items;
  }

  if (experience === "courier") {
    if (input.activeDeliveries > 0) {
      items.push({
        id: "deliveries",
        labelKey: "workspace.attention.deliveries",
        bodyKey: "workspace.attention.deliveriesBody",
        count: input.activeDeliveries,
        href: "/courier",
        tone: "warning",
      });
    }
    if (input.unreadMessages > 0) {
      items.push({
        id: "messages",
        labelKey: "workspace.attention.messages",
        bodyKey: "workspace.attention.messagesBody",
        count: input.unreadMessages,
        href: "/messages",
        tone: "info",
      });
    }
    return items;
  }

  if (input.buyerOpenOrders > 0) {
    items.push({
      id: "orders",
      labelKey: "workspace.attention.buyerOrders",
      bodyKey: "workspace.attention.buyerOrdersBody",
      count: input.buyerOpenOrders,
      href: "/account/orders",
      tone: "warning",
    });
  }
  if (input.savedProducts > 0) {
    items.push({
      id: "saved",
      labelKey: "workspace.attention.saved",
      bodyKey: "workspace.attention.savedBody",
      count: input.savedProducts,
      href: "/account/wishlist",
      tone: "info",
    });
  }
  if (input.unreadMessages > 0) {
    items.push({
      id: "messages",
      labelKey: "workspace.attention.messages",
      bodyKey: "workspace.attention.messagesBody",
      count: input.unreadMessages,
      href: "/messages",
      tone: "info",
    });
  }

  return items;
}

/** Greeting key for the current hour, so the home screen opens like a conversation. */
export function greetingKey(hour: number): string {
  if (hour < 12) return "workspace.greetingMorning";
  if (hour < 18) return "workspace.greetingAfternoon";
  return "workspace.greetingEvening";
}

/** Builds a public handle from a product name, exactly as the catalog expects it. */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");
}
