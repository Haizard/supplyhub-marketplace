import { describe, expect, it } from "vitest";

import { canTransitionCampaign, CAMPAIGN_TRANSITIONS } from "@/features/groupbuy/status";
import { canTransitionCorridor, CORRIDOR_TRANSITIONS } from "@/features/logistics-regional/status";
import { canTransitionBooking, BOOKING_TRANSITIONS } from "@/features/services/status";

describe("Phase 7 — services marketplace booking state machine", () => {
  it("allows forward transitions from REQUESTED", () => {
    expect(canTransitionBooking("REQUESTED", "CONFIRMED")).toBe(true);
    expect(canTransitionBooking("REQUESTED", "CANCELLED")).toBe(true);
    expect(canTransitionBooking("REQUESTED", "COMPLETED")).toBe(false);
  });

  it("allows completion from confirmed and in-progress", () => {
    expect(canTransitionBooking("CONFIRMED", "IN_PROGRESS")).toBe(true);
    expect(canTransitionBooking("CONFIRMED", "COMPLETED")).toBe(true);
    expect(canTransitionBooking("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransitionBooking("IN_PROGRESS", "COMPLETED")).toBe(true);
  });

  it("blocks transitions from terminal states", () => {
    expect(canTransitionBooking("COMPLETED", "CANCELLED")).toBe(false);
    expect(canTransitionBooking("CANCELLED", "CONFIRMED")).toBe(false);
    expect(canTransitionBooking("NO_SHOW", "COMPLETED")).toBe(false);
  });

  it("defines all six statuses", () => {
    expect(Object.keys(BOOKING_TRANSITIONS).sort()).toEqual([
      "CANCELLED",
      "COMPLETED",
      "CONFIRMED",
      "IN_PROGRESS",
      "NO_SHOW",
      "REQUESTED",
    ]);
  });
});

describe("Phase 7 — group buy campaign state machine", () => {
  it("allows draft to active and cancelled", () => {
    expect(canTransitionCampaign("DRAFT", "ACTIVE")).toBe(true);
    expect(canTransitionCampaign("DRAFT", "CANCELLED")).toBe(true);
    expect(canTransitionCampaign("DRAFT", "FUNDED")).toBe(false);
  });

  it("allows active to funded, expired, or cancelled", () => {
    expect(canTransitionCampaign("ACTIVE", "FUNDED")).toBe(true);
    expect(canTransitionCampaign("ACTIVE", "EXPIRED")).toBe(true);
    expect(canTransitionCampaign("ACTIVE", "CANCELLED")).toBe(true);
    expect(canTransitionCampaign("ACTIVE", "COMPLETED")).toBe(false);
  });

  it("allows funded to completed or cancelled", () => {
    expect(canTransitionCampaign("FUNDED", "COMPLETED")).toBe(true);
    expect(canTransitionCampaign("FUNDED", "CANCELLED")).toBe(true);
  });

  it("blocks transitions from terminal states", () => {
    expect(canTransitionCampaign("COMPLETED", "CANCELLED")).toBe(false);
    expect(canTransitionCampaign("EXPIRED", "ACTIVE")).toBe(false);
    expect(canTransitionCampaign("CANCELLED", "ACTIVE")).toBe(false);
  });

  it("defines all six statuses", () => {
    expect(Object.keys(CAMPAIGN_TRANSITIONS).sort()).toEqual([
      "ACTIVE",
      "CANCELLED",
      "COMPLETED",
      "DRAFT",
      "EXPIRED",
      "FUNDED",
    ]);
  });
});

describe("Phase 7 — regional corridor state machine", () => {
  it("allows draft to active", () => {
    expect(canTransitionCorridor("DRAFT", "ACTIVE")).toBe(true);
    expect(canTransitionCorridor("DRAFT", "INACTIVE")).toBe(false);
  });

  it("allows toggling between active and inactive", () => {
    expect(canTransitionCorridor("ACTIVE", "INACTIVE")).toBe(true);
    expect(canTransitionCorridor("INACTIVE", "ACTIVE")).toBe(true);
  });

  it("blocks draft to inactive", () => {
    expect(canTransitionCorridor("DRAFT", "INACTIVE")).toBe(false);
  });

  it("defines all three statuses", () => {
    expect(Object.keys(CORRIDOR_TRANSITIONS).sort()).toEqual(["ACTIVE", "DRAFT", "INACTIVE"]);
  });
});
