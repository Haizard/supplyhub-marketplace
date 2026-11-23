import "server-only";

import { getDatabase } from "@/server/db/client";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { deliverPhoneCode } from "@/server/security/phone-otp-outbox";

import { generateBackupCodes, hashBackupCode } from "./backup-codes";
import { generatePhoneCode, hashPhoneCode } from "./phone-code";
import { decryptTotpSecret, encryptTotpSecret } from "./secret-crypto";
import { generateTotpSecret, verifyTotpCode } from "./totp";
import type { SecurityStatus, TwoFactorSetup } from "./types";

const PHONE_CODE_LIFETIME_MS = 10 * 60 * 1000;
const MAX_PHONE_ATTEMPTS = 5;

export async function getSecurityStatus(userId: string): Promise<SecurityStatus | null> {
  const user = await getDatabase().user.findUnique({
    where: { id: userId },
    select: {
      phone: true,
      phoneVerifiedAt: true,
      twoFactorEnabled: true,
      backupCodes: { where: { usedAt: null }, select: { id: true } },
    },
  });

  if (!user) {
    return null;
  }

  return {
    twoFactorEnabled: user.twoFactorEnabled,
    phone: user.phone,
    phoneVerified: user.phoneVerifiedAt !== null,
    backupCodesRemaining: user.backupCodes.length,
  };
}

async function replaceBackupCodes(
  transaction: Parameters<typeof recordAuditEvent>[0],
  userId: string,
): Promise<string[]> {
  const codes = generateBackupCodes();

  await transaction.backupCode.deleteMany({ where: { userId } });
  await transaction.backupCode.createMany({
    data: codes.map((code) => ({ userId, codeHash: hashBackupCode(code) })),
  });

  return codes;
}

export async function startTwoFactorSetup(userId: string): Promise<TwoFactorSetup> {
  const secret = generateTotpSecret();
  const database = getDatabase();

  const backupCodes = await database.$transaction(async (transaction) => {
    const codes = await replaceBackupCodes(transaction, userId);

    await transaction.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: encryptTotpSecret(secret),
        twoFactorLastStep: null,
      },
    });

    await recordAuditEvent(transaction, {
      actorId: userId,
      action: "TWO_FACTOR_SETUP_STARTED",
      targetType: "user",
      targetId: userId,
    });

    return codes;
  });

  return { secret, backupCodes };
}

export async function confirmTwoFactorSetup(userId: string, code: string): Promise<boolean> {
  const user = await getDatabase().user.findUnique({
    where: { id: userId },
    select: { twoFactorSecret: true },
  });

  if (!user?.twoFactorSecret) {
    return false;
  }

  let secret: string;
  try {
    secret = decryptTotpSecret(user.twoFactorSecret);
  } catch {
    return false;
  }

  const step = verifyTotpCode(secret, code);
  if (step === null) {
    return false;
  }

  await getDatabase().$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorLastStep: step },
    });

    await recordAuditEvent(transaction, {
      actorId: userId,
      action: "TWO_FACTOR_ENABLED",
      targetType: "user",
      targetId: userId,
    });
  });

  return true;
}

export async function verifySecondFactor(userId: string, code: string): Promise<boolean> {
  const user = await getDatabase().user.findUnique({
    where: { id: userId },
    select: {
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorLastStep: true,
      sessionVersion: true,
    },
  });

  if (!user?.twoFactorEnabled) {
    return false;
  }

  if (/^\d{6}$/.test(code)) {
    if (!user.twoFactorSecret) {
      return false;
    }

    let secret: string;
    try {
      secret = decryptTotpSecret(user.twoFactorSecret);
    } catch {
      return false;
    }

    const step = verifyTotpCode(secret, code, { lastStep: user.twoFactorLastStep });
    if (step === null) {
      return false;
    }

    await getDatabase().user.update({
      where: { id: userId },
      data: { twoFactorLastStep: step },
    });

    return true;
  }

  const record = await getDatabase().backupCode.findFirst({
    where: { userId, codeHash: hashBackupCode(code), usedAt: null },
    select: { id: true },
  });

  if (!record) {
    return false;
  }

  await getDatabase().$transaction(async (transaction) => {
    const consumed = await transaction.backupCode.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    if (consumed.count !== 1) {
      return;
    }

    await transaction.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    });

    await recordAuditEvent(transaction, {
      actorId: userId,
      action: "BACKUP_CODE_USED",
      targetType: "backup_code",
      targetId: record.id,
    });
  });

  return true;
}

export async function disableTwoFactor(userId: string, code: string): Promise<boolean> {
  if (!(await verifySecondFactor(userId, code))) {
    return false;
  }

  await getDatabase().$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorLastStep: null,
        sessionVersion: { increment: 1 },
      },
    });

    await transaction.backupCode.deleteMany({ where: { userId } });

    await recordAuditEvent(transaction, {
      actorId: userId,
      action: "TWO_FACTOR_DISABLED",
      targetType: "user",
      targetId: userId,
    });
  });

  return true;
}

export async function regenerateBackupCodes(
  userId: string,
  code: string,
): Promise<string[] | null> {
  if (!(await verifySecondFactor(userId, code))) {
    return null;
  }

  return getDatabase().$transaction(async (transaction) => {
    const codes = await replaceBackupCodes(transaction, userId);

    await recordAuditEvent(transaction, {
      actorId: userId,
      action: "BACKUP_CODES_REGENERATED",
      targetType: "user",
      targetId: userId,
    });

    return codes;
  });
}

export async function sendPhoneVerification(
  userId: string,
  phone: string,
): Promise<{ delivered: boolean }> {
  const code = generatePhoneCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PHONE_CODE_LIFETIME_MS);

  await getDatabase().$transaction(async (transaction) => {
    await transaction.phoneVerification.deleteMany({ where: { userId, phone, verifiedAt: null } });
    await transaction.phoneVerification.create({
      data: { userId, phone, codeHash: hashPhoneCode(code, phone), expiresAt },
    });

    await recordAuditEvent(transaction, {
      actorId: userId,
      action: "PHONE_VERIFICATION_SENT",
      targetType: "user",
      targetId: userId,
    });
  });

  const delivered = await deliverPhoneCode(phone, code);
  return { delivered };
}

export async function verifyPhoneVerification(userId: string, code: string): Promise<boolean> {
  const record = await getDatabase().phoneVerification.findFirst({
    where: { userId, verifiedAt: null, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, phone: true, codeHash: true, attempts: true },
  });

  if (!record || record.attempts >= MAX_PHONE_ATTEMPTS) {
    return false;
  }

  if (hashPhoneCode(code, record.phone) !== record.codeHash) {
    await getDatabase().phoneVerification.update({
      where: { id: record.id },
      data: {
        attempts: { increment: 1 },
        ...(record.attempts + 1 >= MAX_PHONE_ATTEMPTS ? { usedAt: new Date() } : {}),
      },
    });
    return false;
  }

  await getDatabase().$transaction(async (transaction) => {
    await transaction.phoneVerification.update({
      where: { id: record.id },
      data: { verifiedAt: new Date(), usedAt: new Date() },
    });

    await transaction.phoneVerification.updateMany({
      where: { userId, id: { not: record.id }, verifiedAt: null },
      data: { usedAt: new Date() },
    });

    await transaction.user.update({
      where: { id: userId },
      data: { phone: record.phone, phoneVerifiedAt: new Date() },
    });

    await recordAuditEvent(transaction, {
      actorId: userId,
      action: "PHONE_VERIFIED",
      targetType: "user",
      targetId: userId,
    });
  });

  return true;
}
