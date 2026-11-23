import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/db/client", () => ({ getDatabase: vi.fn() }));
vi.mock("@/server/audit/audit-log", () => ({ recordAuditEvent: vi.fn() }));

import {
  describeDevice,
  describeLocation,
  maskIpAddress,
} from "@/features/security/sign-in-events";

describe("sign-in event request details", () => {
  it("describes common browser and operating system pairs", () => {
    expect(
      describeDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari · iOS");
    expect(
      describeDevice(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
      ),
    ).toBe("Chrome · Windows");
    expect(describeDevice(null)).toBe("Unknown device");
  });

  it("uses deployment geo headers without inventing a location", () => {
    const headers = new Headers({
      "x-vercel-ip-city": "Dar%20es%20Salaam",
      "x-vercel-ip-country-region": "Dar es Salaam",
      "x-vercel-ip-country": "TZ",
    });
    expect(describeLocation(headers)).toBe("Dar es Salaam, Dar es Salaam, TZ");
    expect(describeLocation(new Headers())).toBe("Location unavailable");
  });

  it("masks IPv4 and IPv6 addresses before storing them", () => {
    expect(maskIpAddress(new Headers({ "x-forwarded-for": "41.90.12.34, 10.0.0.1" }))).toBe(
      "41.90.12.x",
    );
    expect(maskIpAddress(new Headers({ "x-real-ip": "2001:db8:abcd:1234:5678::1" }))).toBe(
      "2001:db8:abcd:1234::",
    );
    expect(maskIpAddress(new Headers())).toBeNull();
  });
});
