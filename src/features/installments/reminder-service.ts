import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logging/logger";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { deliverInstallmentEmail } from "@/server/email/installment-email";
import { getDatabase } from "@/server/db/client";

import { isInstallmentOverdue, shouldQueueUpcoming, upcomingReminderDate } from "./overdue-rules";

const UPCOMING_DAYS_BEFORE = 3;

export async function queueInstallmentReminders(now = new Date()): Promise<{
  markedOverdue: number;
  queued: number;
}> {
  const database = getDatabase();
  const agreements = await database.installmentAgreement.findMany({
    where: { status: { in: ["ACTIVE", "OVERDUE"] } },
    select: {
      id: true,
      agreementNumber: true,
      gracePeriodDays: true,
      status: true,
      schedule: {
        where: { status: { in: ["PENDING", "OVERDUE"] } },
        select: {
          id: true,
          sequence: true,
          dueDate: true,
          amount: true,
          currency: true,
          status: true,
        },
        orderBy: { sequence: "asc" },
      },
    },
  });

  let markedOverdue = 0;
  let queued = 0;
  const reminders: Prisma.InstallmentReminderCreateManyInput[] = [];

  for (const agreement of agreements) {
    const nowOverdue = agreement.schedule.some((entry) =>
      isInstallmentOverdue(entry.dueDate, agreement.gracePeriodDays, now),
    );
    if (nowOverdue && agreement.status !== "OVERDUE") {
      await database.installmentAgreement.update({
        where: { id: agreement.id },
        data: { status: "OVERDUE" },
      });
      await recordAuditEvent(database, {
        actorId: null,
        action: "INSTALLMENT_OVERDUE_MARKED",
        targetType: "InstallmentAgreement",
        targetId: agreement.id,
        metadata: { agreementNumber: agreement.agreementNumber },
      });
      markedOverdue += 1;
    }

    for (const entry of agreement.schedule) {
      if (entry.status === "PAID" || entry.status === "WAIVED") continue;
      if (isInstallmentOverdue(entry.dueDate, agreement.gracePeriodDays, now)) {
        reminders.push({
          agreementId: agreement.id,
          scopeKey: entry.id,
          reminderType: "OVERDUE",
          dueAt: now,
        });
      } else if (shouldQueueUpcoming(entry.dueDate, UPCOMING_DAYS_BEFORE, now)) {
        reminders.push({
          agreementId: agreement.id,
          scopeKey: entry.id,
          reminderType: "UPCOMING",
          dueAt: upcomingReminderDate(entry.dueDate, UPCOMING_DAYS_BEFORE),
        });
      }
    }
  }

  if (reminders.length > 0) {
    const result = await database.installmentReminder.createMany({
      data: reminders,
      skipDuplicates: true,
    });
    queued = result.count;
    if (queued > 0) {
      await recordAuditEvent(database, {
        actorId: null,
        action: "INSTALLMENT_REMINDER_QUEUED",
        targetType: "InstallmentReminder",
        targetId: "",
        metadata: { count: queued },
      });
    }
  }

  return { markedOverdue, queued };
}

/** Sends due reminders. A reminder whose instalment was paid is skipped. */
export async function dispatchInstallmentReminders(
  limit = 25,
  now = new Date(),
): Promise<{ sent: number; failed: number; skipped: number }> {
  const database = getDatabase();
  const result = { sent: 0, failed: 0, skipped: 0 };
  const due = await database.installmentReminder.findMany({
    where: { status: "PENDING", dueAt: { lte: now } },
    orderBy: { dueAt: "asc" },
    take: limit,
    select: {
      id: true,
      scopeKey: true,
      reminderType: true,
      attempts: true,
      agreement: {
        select: {
          id: true,
          agreementNumber: true,
          buyer: { select: { email: true } },
          business: { select: { name: true } },
        },
      },
    },
  });

  for (const reminder of due) {
    let schedule: {
      amount: { toString(): string };
      currency: string;
      sequence: number;
      status: string;
    } | null = null;
    if (reminder.scopeKey !== "agreement") {
      schedule = await database.installmentSchedule.findUnique({
        where: { id: reminder.scopeKey },
        select: { amount: true, currency: true, sequence: true, status: true },
      });
      if (schedule && ["PAID", "WAIVED"].includes(schedule.status)) {
        await database.installmentReminder.update({
          where: { id: reminder.id },
          data: { status: "SKIPPED", lastError: "Instalment already settled." },
        });
        result.skipped += 1;
        continue;
      }
    }

    const agreement = reminder.agreement;
    const overdue = reminder.reminderType === "OVERDUE";
    const subject = overdue
      ? `Overdue installment — ${agreement.agreementNumber}`
      : `Upcoming installment — ${agreement.agreementNumber}`;
    const body = [
      `Hello,`,
      "",
      overdue
        ? `An installment on agreement ${agreement.agreementNumber} with ${agreement.business.name} is overdue.`
        : `An installment on agreement ${agreement.agreementNumber} with ${agreement.business.name} is due soon.`,
      schedule
        ? `Instalment #${schedule.sequence}: ${schedule.amount.toString()} ${schedule.currency}`
        : "Please review your agreement for details.",
      "",
      "Open your installment dashboard to view the full schedule and payment history.",
    ].join("\n");

    let delivered = false;
    try {
      delivered = await deliverInstallmentEmail({
        to: agreement.buyer.email,
        subject,
        body,
        purpose: "reminder",
      });
    } catch (error) {
      logger.error("installment.reminder_delivery_error", {
        reminderId: reminder.id,
        message: error instanceof Error ? error.message : "unknown error",
      });
    }

    await database.$transaction(async (tx) => {
      await tx.installmentReminder.update({
        where: { id: reminder.id },
        data: {
          status: delivered ? "SENT" : "FAILED",
          attempts: reminder.attempts + 1,
          sentAt: delivered ? now : null,
          lastError: delivered ? null : "Email delivery was not confirmed.",
        },
      });
      if (delivered) {
        await recordAuditEvent(tx, {
          actorId: null,
          action: "INSTALLMENT_REMINDER_SENT",
          targetType: "InstallmentReminder",
          targetId: reminder.id,
          metadata: {
            agreementId: agreement.id,
            reminderType: reminder.reminderType,
          },
        });
      }
    });
    if (delivered) result.sent += 1;
    else result.failed += 1;
  }

  return result;
}
