import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getServerEnv } from "@/lib/config/env";
import { logger } from "@/lib/logging/logger";

/**
 * Phone delivery is intentionally provider-neutral. No SMS business policy or
 * vendor is documented yet, so development writes a local outbox and production
 * reports that delivery is unconfigured rather than inventing a provider.
 */
export async function deliverPhoneCode(phone: string, code: string): Promise<boolean> {
  const env = getServerEnv();

  if (env.NODE_ENV === "test") {
    return true;
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
