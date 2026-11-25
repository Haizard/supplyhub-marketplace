import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getServerEnv } from "@/lib/config/env";
import { logger } from "@/lib/logging/logger";

import { smtpTransport } from "./account-email";

export interface InstallmentEmail {
  to: string;
  subject: string;
  body: string;
  purpose: "reminder" | "receipt";
}

/**
 * Sends transactional installment messages through the same SMTP configuration
 * as account email. In development, writes a local outbox file instead.
 */
export async function deliverInstallmentEmail(input: InstallmentEmail): Promise<boolean> {
  const env = getServerEnv();
  if (env.NODE_ENV === "test") return true;

  const from = env.EMAIL_FROM ?? env.SMTP_USER;
  const transport = smtpTransport(env);

  if (transport && from) {
    try {
      const info = await transport.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        text: input.body,
      });
      logger.info("installment.email_sent", { purpose: input.purpose, messageId: info.messageId });
      return true;
    } catch (error) {
      logger.error("installment.email_failed", { purpose: input.purpose, error });
      return false;
    } finally {
      transport.close();
    }
  }

  if (env.NODE_ENV === "production") {
    logger.warn("installment.email_unconfigured", { purpose: input.purpose });
    return false;
  }

  const outbox = path.join(process.cwd(), ".local", "mail-outbox");
  await mkdir(outbox, { recursive: true });
  await writeFile(
    path.join(outbox, `${Date.now()}-${input.purpose}-${randomUUID()}.txt`),
    `To: ${input.to}\nSubject: ${input.subject}\n\n${input.body}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  return true;
}
