import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getServerEnv } from "@/lib/config/env";
import { logger } from "@/lib/logging/logger";

const TIMEOUT_MS = 8_000;

/**
 * Provider-neutral phone delivery. With SMS_PROVIDER=webhook the code is posted
 * to a configured internal SMS gateway. Without a configured provider, development
 * writes a local outbox and production reports unconfigured rather than inventing
 * a vendor or business policy.
 */
export async function deliverPhoneCode(phone: string, code: string): Promise<boolean> {
  const env = getServerEnv();

  if (env.NODE_ENV === "test") return true;

  if (env.SMS_PROVIDER === "webhook" && env.SMS_WEBHOOK_URL) {
    try {
      const response = await fetch(env.SMS_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.SMS_WEBHOOK_TOKEN ? { Authorization: `Bearer ${env.SMS_WEBHOOK_TOKEN}` } : {}),
        },
        body: JSON.stringify({
          to: phone,
          message: `Your SupplyHub verification code is ${code}. It expires in 10 minutes.`,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        logger.warn("phone.webhook_http_error", { status: response.status });
        return false;
      }
      logger.info("phone.webhook_sent", { status: response.status });
      return true;
    } catch (error) {
      logger.error("phone.webhook_failed", {
        message: error instanceof Error ? error.message : "unknown error",
      });
      return false;
    }
  }

  if (env.NODE_ENV === "production") {
    logger.warn("phone.delivery_unconfigured", { purpose: "verification" });
    return false;
  }

  const outbox = path.join(process.cwd(), ".local", "sms-outbox");
  const filename = `${Date.now()}-phone-${randomUUID()}.txt`;

  await mkdir(outbox, { recursive: true });
  await writeFile(
    path.join(outbox, filename),
    `To: ${phone}\n\nYour SupplyHub verification code is ${code}. It expires in 10 minutes.\n`,
    { encoding: "utf8", mode: 0o600 },
  );

  logger.info("phone.dev_outbox_written", { purpose: "verification", filename });
  return true;
}
