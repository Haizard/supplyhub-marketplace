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

export const EXPERIENCES = ["seller", "farmer", "logistics", "courier", "buyer"] as const;

export type ExperienceId = (typeof EXPERIENCES)[number];

export interface ExperienceAvailability {
  seller: boolean;
  farmer: boolean;
  logistics: boolean;
  courier: boolean;
  buyer: boolean;
}

/**
 * Links that need an identifier the pure layer cannot invent. The caller reads
 * it from the server snapshot; nothing here is trusted for authorization.
 */
export interface ExperienceContext {
  logisticsCompanyId?: string | null;
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
  | "sprout"
  | "wheat"
  | "building"
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

const FARMER_TASKS: WorkspaceTask[] = [
  {
    id: "record-harvest",
    labelKey: "workspace.tasks.recordHarvest",
    bodyKey: "workspace.tasks.recordHarvestBody",
    href: "/agriculture/farm-management",
    icon: "sprout",
  },
  {
    id: "sell-produce",
    labelKey: "workspace.tasks.sellProduce",
    bodyKey: "workspace.tasks.sellProduceBody",
    href: "/agriculture/farmer",
    icon: "wheat",
  },
  {
    id: "my-contracts",
    labelKey: "workspace.tasks.myContracts",
    bodyKey: "workspace.tasks.myContractsBody",
    href: "/agriculture/contracts",
    icon: "list",
  },
  {
    id: "my-groups",
    labelKey: "workspace.tasks.myGroups",
    bodyKey: "workspace.tasks.myGroupsBody",
    href: "/agriculture/groups",
    icon: "users",
  },
];

/** A logistics company member works inside one company, so links carry its id. */
function logisticsHref(companyId: string | null, path = ""): string {
  return companyId ? `/logistics/${companyId}${path}` : "/logistics";
}

function logisticsTasks(companyId: string | null): WorkspaceTask[] {
  if (!companyId) {
    return [
      {
        id: "open-network",
        labelKey: "workspace.tasks.openNetwork",
        bodyKey: "workspace.tasks.openNetworkBody",
        href: "/logistics",
        icon: "building",
      },
    ];
  }

  return [
    {
      id: "dispatch",
      labelKey: "workspace.tasks.dispatch",
      bodyKey: "workspace.tasks.dispatchBody",
      href: logisticsHref(companyId, "/dispatch"),
      icon: "truck",
    },
    {
      id: "company-deliveries",
      labelKey: "workspace.tasks.companyDeliveries",
      bodyKey: "workspace.tasks.companyDeliveriesBody",
      href: logisticsHref(companyId, "/jobs"),
      icon: "package",
    },
    {
      id: "clients",
      labelKey: "workspace.tasks.clients",
      bodyKey: "workspace.tasks.clientsBody",
      href: logisticsHref(companyId, "/clients"),
      icon: "users",
    },
    {
      id: "team",
      labelKey: "workspace.tasks.team",
      bodyKey: "workspace.tasks.teamBody",
      href: logisticsHref(companyId, "/members"),
      icon: "building",
    },
  ];
}

/** The four (or three) things this person most likely opened the app to do. */
export function tasksFor(
  experience: ExperienceId,
  context: ExperienceContext = {},
): WorkspaceTask[] {
  if (experience === "seller") return SELLER_TASKS;
  if (experience === "farmer") return FARMER_TASKS;
  if (experience === "logistics") return logisticsTasks(context.logisticsCompanyId ?? null);
  if (experience === "courier") return COURIER_TASKS;
  return BUYER_TASKS;
}

/**
 * The universal Create catalogue. The same launcher serves every role; only the
 * actions that make sense for the active experience are listed.
 */
export function actionsFor(
  experience: ExperienceId,
  context: ExperienceContext = {},
): WorkspaceTask[] {
  if (experience === "farmer") {
    return [
      FARMER_TASKS[1]!,
      FARMER_TASKS[0]!,
      {
        id: "farm-delivery",
        labelKey: "workspace.actions.farmDelivery",
        bodyKey: "workspace.actions.farmDeliveryBody",
        href: "/agriculture/logistics",
        icon: "truck",
      },
      {
        id: "ask-assistant",
        labelKey: "workspace.actions.askAssistant",
        bodyKey: "workspace.actions.askAssistantBody",
        href: "/agriculture/assistant",
        icon: "compass",
      },
    ];
  }

  if (experience === "logistics") {
    const companyId = context.logisticsCompanyId ?? null;
    return [
      {
        id: "new-delivery",
        labelKey: "workspace.actions.newDelivery",
        bodyKey: "workspace.actions.newDeliveryBody",
        href: companyId ? logisticsHref(companyId, "/dispatch") : "/delivery/request",
        icon: "truck",
      },
      {
        id: "add-client",
        labelKey: "workspace.actions.addClient",
        bodyKey: "workspace.actions.addClientBody",
        href: logisticsHref(companyId, "/clients"),
        icon: "users",
      },
      {
        id: "invite-member",
        labelKey: "workspace.actions.inviteMember",
        bodyKey: "workspace.actions.inviteMemberBody",
        href: logisticsHref(companyId, "/members"),
        icon: "building",
      },
    ];
  }

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
  if (experience === "farmer") return "workspace.create.hintFarmer";
  if (experience === "logistics") return "workspace.create.hintLogistics";
  if (experience === "courier") return "workspace.create.hintCourier";
  return "workspace.create.hintBuyer";
}

/** Five destinations at most, so a phone screen never needs a menu maze. */
export function navFor(
  experience: ExperienceId,
  context: ExperienceContext = {},
): WorkspaceNavItem[] {
  const activitiesHref =
    experience === "seller"
      ? "/vendor/orders"
      : experience === "farmer"
        ? "/agriculture/farm-management"
        : experience === "logistics"
          ? logisticsHref(context.logisticsCompanyId ?? null, "/dispatch")
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
  pendingAgreements: number;
  openOpportunities: number;
  logisticsCompanyId: string | null;
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

  if (experience === "farmer") {
    if (input.pendingAgreements > 0) {
      items.push({
        id: "agreements",
        labelKey: "workspace.attention.agreements",
        bodyKey: "workspace.attention.agreementsBody",
        count: input.pendingAgreements,
        href: "/agriculture/contracts",
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

  if (experience === "logistics") {
    if (input.activeDeliveries > 0) {
      items.push({
        id: "deliveries",
        labelKey: "workspace.attention.deliveries",
        bodyKey: "workspace.attention.deliveriesBody",
        count: input.activeDeliveries,
        href: logisticsHref(input.logisticsCompanyId, "/jobs"),
        tone: "warning",
      });
    }
    if (input.openOpportunities > 0) {
      items.push({
        id: "opportunities",
        labelKey: "workspace.attention.opportunities",
        bodyKey: "workspace.attention.opportunitiesBody",
        count: input.openOpportunities,
        href: logisticsHref(input.logisticsCompanyId, "/opportunities"),
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
