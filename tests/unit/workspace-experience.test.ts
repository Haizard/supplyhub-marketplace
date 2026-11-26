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
  pendingAgreements: 0,
  openOpportunities: 0,
  logisticsCompanyId: null,
};

const everyCapability = {
  seller: true,
  farmer: true,
  logistics: true,
  courier: true,
  buyer: true,
};

const noCapability = {
  seller: false,
  farmer: false,
  logistics: false,
  courier: false,
  buyer: false,
};

describe("experience resolution", () => {
  it("offers one entry per capability the person actually has", () => {
    expect(availableExperiences(everyCapability)).toEqual([
      "seller",
      "farmer",
      "logistics",
      "courier",
      "buyer",
    ]);
    expect(availableExperiences(noCapability)).toEqual(["buyer"]);
  });

  it("opens a farmer or a logistics member on their own work, not on buying", () => {
    const farmer = availableExperiences({
      ...noCapability,
      farmer: true,
      buyer: true,
    });
    expect(farmer).toEqual(["farmer", "buyer"]);
    expect(resolveExperience(undefined, farmer)).toBe("farmer");

    const logistics = availableExperiences({
      ...noCapability,
      logistics: true,
      buyer: true,
    });
    expect(logistics).toEqual(["logistics", "buyer"]);
    expect(resolveExperience(undefined, logistics)).toBe("logistics");
  });

  it("never honours a view the person cannot open", () => {
    expect(resolveExperience("courier", ["seller", "buyer"])).toBe("seller");
    expect(resolveExperience(["courier"], ["seller", "buyer", "courier"])).toBe("courier");
    expect(resolveExperience(undefined, ["buyer"])).toBe("buyer");
    expect(resolveExperience("seller", [])).toBe("buyer");
  });

  it("keeps navigation to five destinations and labels every task", () => {
    const context = { logisticsCompanyId: "3f0c1d9e-0000-4000-8000-000000000000" };
    for (const experience of ["seller", "farmer", "logistics", "courier", "buyer"] as const) {
      const nav = navFor(experience, context);
      expect(nav.length).toBeLessThanOrEqual(5);
      expect(nav[0]?.href).toBe("/workspace");
      for (const task of [...tasksFor(experience, context), ...actionsFor(experience, context)]) {
        expect(task.labelKey.startsWith("workspace.")).toBe(true);
        expect(task.href.startsWith("/")).toBe(true);
      }
    }
  });

  it("keeps a logistics member inside their own company", () => {
    const companyId = "3f0c1d9e-0000-4000-8000-000000000000";
    const tasks = tasksFor("logistics", { logisticsCompanyId: companyId });
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((task) => task.href.startsWith(`/logistics/${companyId}`))).toBe(true);
    expect(navFor("logistics", { logisticsCompanyId: companyId })[2]?.href).toBe(
      `/logistics/${companyId}/dispatch`,
    );
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

  it("asks a farmer for the agreements still waiting on them", () => {
    const items = buildAttention("farmer", {
      ...noAttention,
      pendingAgreements: 2,
      ordersToPrepare: 7,
    });

    expect(items.map((item) => item.id)).toEqual(["agreements"]);
    expect(items[0]?.href).toBe("/agriculture/contracts");
  });

  it("keeps a logistics member's work and opportunities in their company", () => {
    const companyId = "3f0c1d9e-0000-4000-8000-000000000000";
    const items = buildAttention("logistics", {
      ...noAttention,
      activeDeliveries: 1,
      openOpportunities: 3,
      logisticsCompanyId: companyId,
    });

    expect(items.map((item) => item.id)).toEqual(["deliveries", "opportunities"]);
    expect(items.map((item) => item.href)).toEqual([
      `/logistics/${companyId}/jobs`,
      `/logistics/${companyId}/opportunities`,
    ]);
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
