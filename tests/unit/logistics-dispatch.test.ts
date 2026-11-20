import { describe, expect, it } from "vitest";

import { haversineKm, pickBestAgent, scoreCandidate } from "@/features/logistics/dispatch";
import { canActorTransition, canTransitionJob } from "@/features/logistics/status";

describe("delivery dispatch", () => {
  it("measures distance between two points", () => {
    expect(haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 })).toBe(0);
    // 0.1 degrees of longitude near the equator is roughly 11 km.
    const tenthDegree = haversineKm(
      { latitude: -6.8, longitude: 39.2 },
      { latitude: -6.8, longitude: 39.3 },
    );
    expect(tenthDegree).toBeGreaterThan(10);
    expect(tenthDegree).toBeLessThan(12);
  });

  it("prefers a nearby, well-rated agent in the service area", () => {
    const near = scoreCandidate({
      agentId: "near",
      distanceKm: 1,
      rating: 5,
      completedTrips: 40,
      inServiceArea: true,
      capacity: 3,
      activeJobs: 0,
    });
    const far = scoreCandidate({
      agentId: "far",
      distanceKm: 30,
      rating: 4,
      completedTrips: 5,
      inServiceArea: false,
      capacity: 3,
      activeJobs: 0,
    });
    expect(near.eligible).toBe(true);
    expect(near.score).toBeGreaterThan(far.score);
  });

  it("excludes agents at capacity", () => {
    const best = pickBestAgent([
      {
        agentId: "busy",
        distanceKm: 0,
        rating: 5,
        completedTrips: 50,
        inServiceArea: true,
        capacity: 1,
        activeJobs: 1,
      },
      {
        agentId: "free",
        distanceKm: 8,
        rating: 4,
        completedTrips: 10,
        inServiceArea: true,
        capacity: 2,
        activeJobs: 0,
      },
    ]);
    expect(best?.agentId).toBe("free");
  });

  it("returns null when no agent is eligible", () => {
    expect(
      pickBestAgent([
        {
          agentId: "busy",
          distanceKm: 1,
          rating: 5,
          completedTrips: 20,
          inServiceArea: true,
          capacity: 1,
          activeJobs: 1,
        },
      ]),
    ).toBeNull();
  });
});

describe("delivery lifecycle", () => {
  it("allows only forward transitions", () => {
    expect(canTransitionJob("ASSIGNED", "ACCEPTED")).toBe(true);
    expect(canTransitionJob("ACCEPTED", "TRANSIT")).toBe(false);
    expect(canTransitionJob("DELIVERED", "TRANSIT")).toBe(false);
    expect(canTransitionJob("CANCELLED", "ACCEPTED")).toBe(false);
  });

  it("restricts cancellation to requesters and admins", () => {
    expect(canActorTransition("TRANSIT", "CANCELLED", "agent")).toBe(false);
    expect(canActorTransition("TRANSIT", "CANCELLED", "requester")).toBe(true);
    expect(canActorTransition("TRANSIT", "CANCELLED", "admin")).toBe(true);
  });

  it("lets agents and admins drive the hand-over", () => {
    expect(canActorTransition("TRANSIT", "DELIVERED", "agent")).toBe(true);
    expect(canActorTransition("TRANSIT", "DELIVERED", "requester")).toBe(false);
    expect(canActorTransition("TRANSIT", "DELIVERED", "admin")).toBe(true);
  });
});
