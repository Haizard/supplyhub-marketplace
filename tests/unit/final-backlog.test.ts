import { describe, expect, it, vi } from "vitest";

import {
  canAcceptFinancing,
  canDecideFinancing,
  canFundFinancing,
} from "@/features/installments/financing-rules";
import { SEARCH_SUGGEST_RATE_LIMIT } from "@/server/security/rate-limit";
import { FixedWindowRateLimiter } from "@/server/security/rate-limiter";

const envState = {
  NODE_ENV: "development",
  SMS_PROVIDER: "none" as "none" | "webhook",
  SMS_WEBHOOK_URL: undefined as string | undefined,
  SMS_WEBHOOK_TOKEN: undefined as string | undefined,
};

vi.mock("@/lib/config/env", () => ({ getServerEnv: () => envState }));

import { deliverPhoneCode } from "@/server/security/phone-otp-outbox";

describe("Phone verification provider", () => {
  it("posts the code to a configured webhook with a bearer token", async () => {
    envState.SMS_PROVIDER = "webhook";
    envState.SMS_WEBHOOK_URL = "https://sms.example.com/send";
    envState.SMS_WEBHOOK_TOKEN = "provider-secret";
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const original = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      expect(await deliverPhoneCode("+255700000000", "123456")).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://sms.example.com/send");
      expect((init.headers as Record<string, string>).Authorization).toBe("Bearer provider-secret");
      expect(JSON.stringify(init.body)).toContain("123456");
      expect(url).not.toContain("provider-secret");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("reports failure when the provider rejects the message", async () => {
    envState.SMS_PROVIDER = "webhook";
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 502 }));
    const original = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      expect(await deliverPhoneCode("+255700000000", "123456")).toBe(false);
    } finally {
      globalThis.fetch = original;
      envState.SMS_PROVIDER = "none";
    }
  });
});

describe("Search suggestion rate limit", () => {
  it("allows the configured window and blocks the next request", () => {
    const limiter = new FixedWindowRateLimiter();
    for (let i = 0; i < SEARCH_SUGGEST_RATE_LIMIT.limit; i++) {
      expect(limiter.consume("addr:1", SEARCH_SUGGEST_RATE_LIMIT).allowed).toBe(true);
    }
    expect(limiter.consume("addr:1", SEARCH_SUGGEST_RATE_LIMIT).allowed).toBe(false);
    expect(limiter.consume("addr:2", SEARCH_SUGGEST_RATE_LIMIT).allowed).toBe(true);
  });
});

describe("Compliance-gated financing workflow", () => {
  it("allows only the documented status transitions", () => {
    expect(canDecideFinancing("SUBMITTED")).toBe(true);
    expect(canDecideFinancing("APPROVED")).toBe(false);
    expect(canAcceptFinancing("APPROVED")).toBe(true);
    expect(canAcceptFinancing("SUBMITTED")).toBe(false);
    expect(canFundFinancing("ACCEPTED")).toBe(true);
    expect(canFundFinancing("APPROVED")).toBe(false);
  });
});
