import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { getServerEnv } from "@/lib/config/env";

const VERSION = "v1";

function encryptionKey(): Buffer {
  // AUTH_SECRET is already a validated server-only secret. Deriving a scoped key
  // keeps 2FA material separate from session signing without adding a new secret.
  return createHash("sha256")
    .update(`supplyhub:2fa:${getServerEnv().AUTH_SECRET}`, "utf8")
    .digest();
}

export function encryptTotpSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptTotpSecret(stored: string): string {
  const [version, ivPart, tagPart, payloadPart] = stored.split(".");

  if (version !== VERSION || !ivPart || !tagPart || !payloadPart) {
    throw new Error("Unsupported TOTP secret format.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(payloadPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function integrationKey(): Buffer {
  return createHash("sha256")
    .update(`supplyhub:integrations:${getServerEnv().AUTH_SECRET}`, "utf8")
    .digest();
}

/** Integration webhook secrets are encrypted at rest with a server-derived key. */
export function encryptIntegrationSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", integrationKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);

  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptIntegrationSecret(stored: string): string {
  const [version, ivPart, tagPart, payloadPart] = stored.split(".");
  if (version !== VERSION || !ivPart || !tagPart || !payloadPart) {
    throw new Error("Unsupported integration secret format.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    integrationKey(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(payloadPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
