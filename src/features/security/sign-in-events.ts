import "server-only";

import { recordAuditEvent } from "@/server/audit/audit-log";
import { getDatabase } from "@/server/db/client";

import type { SignInEventView } from "./types";

export type SignInMethod = "PASSWORD" | "PASSWORD_TOTP" | "PASSWORD_BACKUP_CODE";

function safeHeader(headers: Headers, name: string): string | null {
  const raw = headers.get(name)?.trim();
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Derives a stable device label from the request without trusting client input. */
export function describeDevice(userAgent: string | null | undefined): string {
  const ua = userAgent?.trim();
  if (!ua) return "Unknown device";

  let browser = "Browser";
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera/")) browser = "Opera";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Chrome/") || ua.includes("CriOS/")) browser = "Chrome";
  else if (ua.includes("Safari/")) browser = "Safari";

  let os = "Unknown OS";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/CrOS/i.test(ua)) os = "ChromeOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  return `${browser} · ${os}`.slice(0, 120);
}

/** Uses deployment-provided geo headers; never guesses a country from an IP. */
export function describeLocation(headers: Headers): string {
  const city = safeHeader(headers, "x-vercel-ip-city") ?? safeHeader(headers, "x-geo-city");
  const region = safeHeader(headers, "x-vercel-ip-country-region");
  const country =
    safeHeader(headers, "x-vercel-ip-country") ??
    safeHeader(headers, "cf-ipcountry") ??
    safeHeader(headers, "x-geo-country");

  const parts = [city, region, country].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(", ").slice(0, 160) : "Location unavailable";
}

/** Stores only a coarse address so the audit trail is useful without keeping full IPs. */
export function maskIpAddress(headers: Headers): string | null {
  const raw =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? headers.get("x-real-ip")?.trim();
  if (!raw) return null;

  if (raw.includes(":")) {
    const segments = raw.split(":").filter(Boolean);
    return `${segments.slice(0, 4).join(":")}::`.slice(0, 64);
  }

  const parts = raw.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.x`.slice(0, 64);
  }
  return raw.slice(0, 64);
}

export async function recordSuccessfulSignIn(input: {
  userId: string;
  request: Request;
  method: SignInMethod;
}): Promise<void> {
  const database = getDatabase();
  const device = describeDevice(input.request.headers.get("user-agent"));
  const location = describeLocation(input.request.headers);
  const ipAddress = maskIpAddress(input.request.headers);

  const previous = await database.signInEvent.findFirst({
    where: { userId: input.userId, device },
    orderBy: { occurredAt: "desc" },
    select: { id: true },
  });
  const newDevice = previous === null;

  await database.$transaction(async (tx) => {
    await tx.signInEvent.create({
      data: {
        userId: input.userId,
        device,
        location,
        ipAddress,
        method: input.method,
        newDevice,
      },
    });
    await recordAuditEvent(tx, {
      actorId: input.userId,
      action: "SIGN_IN_SUCCEEDED",
      targetType: "User",
      targetId: input.userId,
      metadata: { device, location, method: input.method, newDevice },
    });
  });
}

export async function listSignInEvents(userId: string, limit = 12): Promise<SignInEventView[]> {
  const rows = await getDatabase().signInEvent.findMany({
    where: { userId },
    orderBy: { occurredAt: "desc" },
    take: limit,
    select: {
      id: true,
      occurredAt: true,
      device: true,
      location: true,
      method: true,
      newDevice: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    device: row.device,
    location: row.location,
    method: row.method,
    newDevice: row.newDevice,
  }));
}
