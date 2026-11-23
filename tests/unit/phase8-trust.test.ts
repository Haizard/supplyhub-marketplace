import { describe, expect, it } from "vitest";

import { canTransitionDispute, isDisputeClosed } from "@/features/disputes/status";

describe("Phase 8 — dispute state machine", () => {
  it("allows an open dispute to enter review or be rejected", () => {
    expect(canTransitionDispute("OPEN", "UNDER_REVIEW")).toBe(true);
    expect(canTransitionDispute("OPEN", "REJECTED")).toBe(true);
    expect(canTransitionDispute("OPEN", "RESOLVED")).toBe(false);
  });

  it("allows a reviewed dispute to be resolved or rejected", () => {
    expect(canTransitionDispute("UNDER_REVIEW", "RESOLVED")).toBe(true);
    expect(canTransitionDispute("UNDER_REVIEW", "REJECTED")).toBe(true);
  });

  it("blocks every transition from a terminal state", () => {
    expect(canTransitionDispute("RESOLVED", "OPEN")).toBe(false);
    expect(canTransitionDispute("REJECTED", "UNDER_REVIEW")).toBe(false);
    expect(isDisputeClosed("RESOLVED")).toBe(true);
    expect(isDisputeClosed("REJECTED")).toBe(true);
    expect(isDisputeClosed("OPEN")).toBe(false);
  });
});
