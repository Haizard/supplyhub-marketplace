import { describe, expect, it } from "vitest";

import {
  actionsFor,
  availableExperiences,
  buildAttention,
  greetingKey,
  navFor,
  resolveExperience,
  slugify,
  tasksFor,
} from "@/features/workspace/experience";

const noAttention = {
  ordersToPrepare: 0,
  paymentsDue: 0,
  lowStock: 0,
  unreadMessages: 0,
  activeDeliveries: 0,
  buyerOpenOrders: 0,
  savedProducts: 0,
};

describe("experience resolution", () => {
  it("offers one entry per capability the person actually has", () => {
    expect(availableExperiences({ seller: true, buyer: true, courier: true })).toEqual([
      "seller",
      "buyer",
      "courier",
    ]);
    expect(availableExperiences({ seller: false, buyer: false, courier: false })).toEqual([
      "buyer",
    ]);
  });

  it("never honours a view the person cannot open", () => {
    expect(resolveExperience("courier", ["seller", "buyer"])).toBe("seller");
    expect(resolveExperience(["courier"], ["seller", "buyer", "courier"])).toBe("courier");
    expect(resolveExperience(undefined, ["buyer"])).toBe("buyer");
    expect(resolveExperience("seller", [])).toBe("buyer");
  });

  it("keeps navigation to five destinations and labels every task", () => {
    for (const experience of ["seller", "buyer", "courier"] as const) {
      const nav = navFor(experience);
      expect(nav.length).toBeLessThanOrEqual(5);
      expect(nav[0]?.href).toBe("/workspace");
      for (const task of [...tasksFor(experience), ...actionsFor(experience)]) {
        expect(task.labelKey.startsWith("workspace.")).toBe(true);
        expect(task.href.startsWith("/")).toBe(true);
      }
    }
  });
});

describe("needs your attention", () => {
  it("stays empty instead of inventing work", () => {
    expect(buildAttention("seller", noAttention)).toEqual([]);
    expect(buildAttention("buyer", noAttention)).toEqual([]);
  });

  it("shows only role-relevant items, in priority order", () => {
    const items = buildAttention("seller", {
      ...noAttention,
      ordersToPrepare: 3,
      paymentsDue: 2,
      lowStock: 5,
      unreadMessages: 4,
      buyerOpenOrders: 9,
    });

    expect(items.map((item) => item.id)).toEqual(["orders", "payments", "stock", "messages"]);
    expect(items[0]?.count).toBe(3);
  });

  it("gives a courier their own deliveries and nothing seller-shaped", () => {
    const items = buildAttention("courier", {
      ...noAttention,
      ordersToPrepare: 3,
      activeDeliveries: 2,
    });

    expect(items.map((item) => item.id)).toEqual(["deliveries"]);
  });
});

describe("guided listing helpers", () => {
  it("builds a safe public handle from a name", () => {
    expect(slugify("Ridge Carafe — Oat Glaze")).toBe("ridge-carafe-oat-glaze");
    expect(slugify("  Maize (cleaned & dried)  ")).toBe("maize-cleaned-dried");
    expect(slugify("!!!")).toBe("");
  });

  it("greets by time of day", () => {
    expect(greetingKey(8)).toBe("workspace.greetingMorning");
    expect(greetingKey(14)).toBe("workspace.greetingAfternoon");
    expect(greetingKey(21)).toBe("workspace.greetingEvening");
  });
});
