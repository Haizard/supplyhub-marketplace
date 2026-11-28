"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { makeDocumentNumber } from "@/features/b2b/pricing";
import { isFeatureEnabled } from "@/features/flags/service";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import { appendOutboxEvent } from "@/features/outbox/service";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { requireActor, requireAdmin } from "@/server/auth/guards";
import { requireLogisticsAccess } from "@/server/logistics/access";
import { getDatabase } from "@/server/db/client";
import { logger } from "@/lib/logging/logger";

import { canTransitionCompany } from "./status";
import {
  assignRoleSchema,
  branchSchema,
  companyReviewSchema,
  companySchema,
  companyUpdateSchema,
  LOGISTICS_PERMISSION_KEYS,
  memberInviteSchema,
  memberStatusSchema,
  roleSchema,
  settingsSchema,
} from "./validation";

function fail(message: string): FormState {
  return { status: "error", message };
}
function failFields(error: z.ZodError): FormState {
  return { status: "error", fieldErrors: firstFieldErrors(error) };
}
function ok(message: string): FormState {
  return { status: "success", message };
}

async function ensureEnabled(): Promise<FormState | null> {
  if (!(await isFeatureEnabled("phase9.logisticsNetwork"))) {
    return fail("The logistics network is not available yet.");
  }
  return null;
}

/** Registers a company and creates its owner membership and owner role. */
export async function registerCompanyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const actor = await requireActor("/logistics");
  const parsed = companySchema.safeParse({
    name: formValue(formData, "name"),
    slug: formValue(formData, "slug"),
    registrationNumber: formValue(formData, "registrationNumber"),
    description: formValue(formData, "description"),
    contactPhone: formValue(formData, "contactPhone"),
    contactEmail: formValue(formData, "contactEmail"),
    address: formValue(formData, "address"),
    city: formValue(formData, "city"),
    coverImageUrl: formValue(formData, "coverImageUrl"),
    countryCode: formValue(formData, "countryCode") || "TZ",
  });
  if (!parsed.success) return failFields(parsed.error);

  const database = getDatabase();
  const existing = await database.logisticsCompany.findFirst({
    where: { OR: [{ slug: parsed.data.slug }, { name: parsed.data.name }] },
    select: { id: true },
  });
  if (existing) return fail("A company with that name or slug already exists.");

  let companyId = "";
  let companyCode = "";

  try {
    await database.$transaction(async (tx) => {
      const permissions = await tx.permission.findMany({
        where: { permissionKey: { in: [...LOGISTICS_PERMISSION_KEYS] } },
        select: { id: true },
      });
      if (permissions.length !== LOGISTICS_PERMISSION_KEYS.length) {
        throw new Error("logistics permissions not registered");
      }

      companyCode = makeDocumentNumber("LC");
      const company = await tx.logisticsCompany.create({
        data: {
          companyCode,
          name: parsed.data.name,
          slug: parsed.data.slug,
          registrationNumber: parsed.data.registrationNumber ?? null,
          description: parsed.data.description ?? null,
          contactPhone: parsed.data.contactPhone ?? null,
          contactEmail: parsed.data.contactEmail ?? null,
          address: parsed.data.address ?? null,
          city: parsed.data.city ?? null,
          coverImageUrl: parsed.data.coverImageUrl ?? null,
          countryCode: parsed.data.countryCode,
          status: "PENDING",
        },
        select: { id: true },
      });
      companyId = company.id;

      const ownerRole = await tx.logisticsCompanyRole.create({
        data: {
          companyId: company.id,
          name: "owner",
          isSystem: true,
          description: "Full control of the logistics company",
        },
        select: { id: true },
      });
      await tx.logisticsRolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId: ownerRole.id,
          permissionId: permission.id,
        })),
      });

      const member = await tx.logisticsCompanyMember.create({
        data: {
          companyId: company.id,
          userId: actor.id,
          status: "ACTIVE",
          joinedAt: new Date(),
        },
        select: { id: true },
      });
      await tx.logisticsMemberRole.create({
        data: { memberId: member.id, roleId: ownerRole.id },
      });

      await recordAuditEvent(tx, {
        actorId: actor.id,
        action: "LOGISTICS_COMPANY_REGISTERED",
        targetType: "LogisticsCompany",
        targetId: company.id,
        metadata: { companyCode, name: parsed.data.name },
      });

      await appendOutboxEvent(tx, {
        eventType: "logistics.company.registered",
        aggregateType: "LogisticsCompany",
        aggregateId: company.id,
        payload: { companyCode, ownerId: actor.id },
      });
    });
  } catch (error) {
    logger.error("logistics.company_register_failed", { actorId: actor.id, error });
    return fail("The company could not be registered.");
  }

  revalidatePath("/logistics");
  revalidatePath(`/logistics/${companyId}`);
  return ok("Company registered. Submit it for verification to go live.");
}

export async function submitCompanyForVerificationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = z.uuid().safeParse(formValue(formData, "companyId"));
  if (!parsed.success) return fail("Invalid company.");
  const access = await requireLogisticsAccess(
    "logistics.company.update",
    parsed.data,
    `/logistics/${parsed.data}`,
  );

  const result = await getDatabase().$transaction(async (tx) => {
    const company = await tx.logisticsCompany.findFirst({
      where: { id: parsed.data, status: "PENDING" },
      select: { id: true, companyCode: true, submittedAt: true },
    });
    if (!company) return "not-pending" as const;
    if (company.submittedAt) return "already-submitted" as const;

    await tx.logisticsCompany.update({
      where: { id: company.id },
      data: { submittedAt: new Date() },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_COMPANY_SUBMITTED",
      targetType: "LogisticsCompany",
      targetId: company.id,
      metadata: { companyCode: company.companyCode },
    });
    await appendOutboxEvent(tx, {
      eventType: "logistics.company.submitted",
      aggregateType: "LogisticsCompany",
      aggregateId: company.id,
      payload: { companyCode: company.companyCode },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${parsed.data}`);
  revalidatePath("/admin/logistics");
  if (result === "not-pending") return fail("Only pending companies can be submitted.");
  if (result === "already-submitted") return fail("This company is already awaiting review.");
  return ok("Submitted for verification.");
}

export async function reviewCompanyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const admin = await requireAdmin();
  const parsed = companyReviewSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    decision: formValue(formData, "decision"),
    note: formValue(formData, "note") || undefined,
  });
  if (!parsed.success) return failFields(parsed.error);

  const { companyId, decision, note } = parsed.data;
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const company = await tx.logisticsCompany.findUnique({
      where: { id: companyId },
      select: { id: true, status: true, submittedAt: true, companyCode: true },
    });
    if (!company) return "not-found" as const;
    if (!company.submittedAt || company.status !== "PENDING") return "not-submitted" as const;
    if (!canTransitionCompany(company.status, decision)) return "invalid-transition" as const;

    await tx.logisticsCompany.update({
      where: { id: company.id },
      data: {
        status: decision,
        reviewedById: admin.id,
        reviewedAt: new Date(),
        rejectionReason: decision === "REJECTED" ? (note ?? "") : null,
      },
    });
    await recordAuditEvent(tx, {
      actorId: admin.id,
      action: decision === "APPROVED" ? "LOGISTICS_COMPANY_APPROVED" : "LOGISTICS_COMPANY_REJECTED",
      targetType: "LogisticsCompany",
      targetId: company.id,
      metadata: { companyCode: company.companyCode, decision },
    });
    await appendOutboxEvent(tx, {
      eventType: `logistics.company.${decision.toLowerCase()}`,
      aggregateType: "LogisticsCompany",
      aggregateId: company.id,
      payload: { companyCode: company.companyCode, decision },
    });
    return "ok" as const;
  });

  revalidatePath("/admin/logistics");
  revalidatePath(`/logistics/${companyId}`);
  if (result === "not-found") return fail("That company could not be found.");
  if (result === "not-submitted") return fail("That company has not submitted for review.");
  if (result === "invalid-transition") return fail("That decision is not allowed.");
  return ok(decision === "APPROVED" ? "Company approved." : "Company rejected.");
}

export async function inviteMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = memberInviteSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    email: formValue(formData, "email"),
    roleIds: formData.getAll("roleIds").map(String),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.company.update",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/members`,
  );
  const database = getDatabase();
  const user = await database.user.findUnique({
    where: { email: parsed.data.email.toLowerCase().trim() },
    select: { id: true, email: true },
  });
  if (!user) return fail("No platform account exists with that email address.");

  const result = await database.$transaction(async (tx) => {
    const roles = await tx.logisticsCompanyRole.findMany({
      where: { id: { in: parsed.data.roleIds }, companyId: access.companyId },
      select: { id: true },
    });
    if (roles.length !== parsed.data.roleIds.length) return "invalid-role" as const;

    const existing = await tx.logisticsCompanyMember.findUnique({
      where: { companyId_userId: { companyId: access.companyId, userId: user.id } },
      select: { id: true },
    });
    if (existing) return "already-member" as const;

    const member = await tx.logisticsCompanyMember.create({
      data: { companyId: access.companyId, userId: user.id, status: "INVITED" },
      select: { id: true },
    });
    await tx.logisticsMemberRole.createMany({
      data: roles.map((role) => ({ memberId: member.id, roleId: role.id })),
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_MEMBER_INVITED",
      targetType: "LogisticsCompanyMember",
      targetId: member.id,
      metadata: { companyId: access.companyId, email: user.email },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${parsed.data.companyId}/members`);
  if (result === "invalid-role") return fail("One of the selected roles is not available.");
  if (result === "already-member") return fail("That user is already a member.");
  return ok("Member invited. Activate the membership to grant access.");
}

export async function updateMemberStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = memberStatusSchema.safeParse({
    memberId: formValue(formData, "memberId"),
    toStatus: formValue(formData, "toStatus"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.company.update",
    z.uuid().parse(formValue(formData, "companyId")),
    "/logistics",
  );

  const result = await getDatabase().$transaction(async (tx) => {
    const member = await tx.logisticsCompanyMember.findFirst({
      where: { id: parsed.data.memberId, companyId: access.companyId },
      select: { id: true, status: true, roles: { select: { role: { select: { name: true } } } } },
    });
    if (!member) return "not-found" as const;

    if (parsed.data.toStatus === "SUSPENDED") {
      const isOwner = member.roles.some((assignment) => assignment.role.name === "owner");
      if (isOwner) {
        const otherOwners = await tx.logisticsCompanyMember.count({
          where: {
            companyId: access.companyId,
            status: "ACTIVE",
            id: { not: member.id },
            roles: { some: { role: { name: "owner" } } },
          },
        });
        if (otherOwners === 0) return "last-owner" as const;
      }
    }

    await tx.logisticsCompanyMember.update({
      where: { id: member.id },
      data: {
        status: parsed.data.toStatus,
        joinedAt: parsed.data.toStatus === "ACTIVE" ? new Date() : undefined,
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_MEMBER_STATUS_CHANGED",
      targetType: "LogisticsCompanyMember",
      targetId: member.id,
      metadata: { status: parsed.data.toStatus },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/members`);
  if (result === "not-found") return fail("That member could not be found.");
  if (result === "last-owner") return fail("The last owner cannot be suspended.");
  return ok("Membership updated.");
}

export async function createRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const permissionKeys = formData.getAll("permissionKeys").map(String);
  const parsed = roleSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    permissionKeys,
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.company.update",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/roles`,
  );
  if (parsed.data.name.toLowerCase() === "owner") return fail("That role name is reserved.");

  const database = getDatabase();
  const permissions = await database.permission.findMany({
    where: { permissionKey: { in: parsed.data.permissionKeys } },
    select: { id: true, permissionKey: true },
  });
  if (permissions.length !== parsed.data.permissionKeys.length) {
    return fail("One of the selected permissions does not exist.");
  }

  await database.$transaction(async (tx) => {
    const role = await tx.logisticsCompanyRole.create({
      data: {
        companyId: access.companyId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      },
      select: { id: true },
    });
    await tx.logisticsRolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_ROLE_CREATED",
      targetType: "LogisticsCompanyRole",
      targetId: role.id,
      metadata: { name: parsed.data.name, permissions: parsed.data.permissionKeys },
    });
  });

  revalidatePath(`/logistics/${access.companyId}/roles`);
  revalidatePath(`/logistics/${access.companyId}/members`);
  return ok("Role created.");
}

export async function assignRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = assignRoleSchema.safeParse({
    memberId: formValue(formData, "memberId"),
    roleId: formValue(formData, "roleId"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const companyId = z.uuid().parse(formValue(formData, "companyId"));
  const access = await requireLogisticsAccess(
    "logistics.company.update",
    companyId,
    `/logistics/${companyId}/members`,
  );
  const database = getDatabase();

  const [member, role] = await Promise.all([
    database.logisticsCompanyMember.findFirst({
      where: { id: parsed.data.memberId, companyId: access.companyId },
      select: { id: true },
    }),
    database.logisticsCompanyRole.findFirst({
      where: { id: parsed.data.roleId, companyId: access.companyId },
      select: { id: true },
    }),
  ]);
  if (!member || !role) return fail("That member or role is not part of this company.");

  await database.$transaction(async (tx) => {
    await tx.logisticsMemberRole.upsert({
      where: {
        memberId_roleId: { memberId: member.id, roleId: role.id },
      },
      create: { memberId: member.id, roleId: role.id },
      update: {},
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_ROLE_ASSIGNED",
      targetType: "LogisticsCompanyMember",
      targetId: member.id,
      metadata: { roleId: role.id },
    });
  });

  revalidatePath(`/logistics/${access.companyId}/members`);
  return ok("Role assigned.");
}

/** Owner/staff edit of the company profile. Status is never client-controlled. */
export async function updateCompanyAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = companyUpdateSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    name: formValue(formData, "name"),
    slug: formValue(formData, "slug"),
    registrationNumber: formValue(formData, "registrationNumber"),
    description: formValue(formData, "description"),
    contactPhone: formValue(formData, "contactPhone"),
    contactEmail: formValue(formData, "contactEmail"),
    address: formValue(formData, "address"),
    city: formValue(formData, "city"),
    coverImageUrl: formValue(formData, "coverImageUrl"),
    countryCode: formValue(formData, "countryCode") || "TZ",
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.company.update",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/edit`,
  );
  const { companyId, ...data } = parsed.data;

  try {
    await getDatabase().$transaction(async (tx) => {
      await tx.logisticsCompany.update({
        where: { id: companyId },
        data: {
          name: data.name,
          slug: data.slug,
          registrationNumber: data.registrationNumber ?? null,
          description: data.description ?? null,
          contactPhone: data.contactPhone ?? null,
          contactEmail: data.contactEmail ?? null,
          address: data.address ?? null,
          city: data.city ?? null,
          coverImageUrl: data.coverImageUrl ?? null,
          countryCode: data.countryCode,
        },
      });
      await recordAuditEvent(tx, {
        actorId: access.actorId,
        action: "LOGISTICS_COMPANY_UPDATED",
        targetType: "LogisticsCompany",
        targetId: companyId,
        metadata: { companyId, name: data.name },
      });
      await appendOutboxEvent(tx, {
        eventType: "logistics.company.updated",
        aggregateType: "LogisticsCompany",
        aggregateId: companyId,
        payload: { name: data.name },
      });
    });
  } catch {
    return fail("The profile could not be saved.");
  }

  revalidatePath(`/logistics/${companyId}`);
  revalidatePath(`/logistics/${companyId}/edit`);
  return ok("Profile saved.");
}

/** Creates or edits a branch. Only one primary branch is kept per company. */
export async function saveBranchAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = branchSchema.safeParse({
    branchId: formValue(formData, "branchId"),
    companyId: formValue(formData, "companyId"),
    name: formValue(formData, "name"),
    branchCode: formValue(formData, "branchCode"),
    address: formValue(formData, "address"),
    city: formValue(formData, "city"),
    latitude: formValue(formData, "latitude"),
    longitude: formValue(formData, "longitude"),
    isPrimary: formValue(formData, "isPrimary") || "off",
    isActive: formValue(formData, "isActive") || "on",
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.company.update",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/branches`,
  );
  // Both coordinates are optional, but a half-filled pair is rejected.
  if ((parsed.data.latitude === undefined) !== (parsed.data.longitude === undefined)) {
    return fail("Provide both latitude and longitude, or neither.");
  }

  const database = getDatabase();
  if (parsed.data.branchId) {
    const existing = await database.logisticsBranch.findFirst({
      where: { id: parsed.data.branchId, companyId: access.companyId },
      select: { id: true },
    });
    if (!existing) return fail("That branch could not be found.");
  }

  const isEdit = Boolean(parsed.data.branchId);
  let branchId = parsed.data.branchId ?? "";

  try {
    await database.$transaction(async (tx) => {
      if (parsed.data.isPrimary) {
        await tx.logisticsBranch.updateMany({
          where: { companyId: access.companyId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      const values = {
        name: parsed.data.name,
        branchCode: parsed.data.branchCode,
        address: parsed.data.address ?? null,
        city: parsed.data.city ?? null,
        latitude: parsed.data.latitude ?? null,
        longitude: parsed.data.longitude ?? null,
        isPrimary: parsed.data.isPrimary,
        isActive: parsed.data.isActive,
      };
      if (isEdit) {
        await tx.logisticsBranch.update({ where: { id: branchId }, data: values });
      } else {
        const created = await tx.logisticsBranch.create({
          data: { companyId: access.companyId, ...values },
          select: { id: true },
        });
        branchId = created.id;
      }

      await recordAuditEvent(tx, {
        actorId: access.actorId,
        action: isEdit ? "LOGISTICS_BRANCH_UPDATED" : "LOGISTICS_BRANCH_CREATED",
        targetType: "LogisticsBranch",
        targetId: branchId,
        metadata: { companyId: access.companyId, name: parsed.data.name },
      });
      await appendOutboxEvent(tx, {
        eventType: isEdit ? "logistics.branch.updated" : "logistics.branch.created",
        aggregateType: "LogisticsBranch",
        aggregateId: branchId,
        payload: { companyId: access.companyId, branchCode: parsed.data.branchCode },
      });
    });
  } catch {
    return fail("The branch could not be saved.");
  }

  revalidatePath(`/logistics/${access.companyId}/branches`);
  return ok(isEdit ? "Branch updated." : "Branch created.");
}

export async function toggleBranchStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = z.object({ companyId: z.uuid(), branchId: z.uuid() }).safeParse({
    companyId: formValue(formData, "companyId"),
    branchId: formValue(formData, "branchId"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.company.update",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/branches`,
  );
  const database = getDatabase();
  const result = await database.$transaction(async (tx) => {
    const branch = await tx.logisticsBranch.findFirst({
      where: { id: parsed.data.branchId, companyId: access.companyId },
      select: { id: true, isActive: true, isPrimary: true },
    });
    if (!branch) return "not-found" as const;
    if (branch.isActive && branch.isPrimary) return "primary" as const;

    await tx.logisticsBranch.update({
      where: { id: branch.id },
      data: { isActive: !branch.isActive },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_BRANCH_UPDATED",
      targetType: "LogisticsBranch",
      targetId: branch.id,
      metadata: { companyId: access.companyId, isActive: !branch.isActive },
    });
    return "ok" as const;
  });

  revalidatePath(`/logistics/${access.companyId}/branches`);
  if (result === "not-found") return fail("That branch could not be found.");
  if (result === "primary")
    return fail("Set another branch as primary before deactivating this one.");
  return ok("Branch status updated.");
}

export async function saveSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const disabled = await ensureEnabled();
  if (disabled) return disabled;

  const parsed = settingsSchema.safeParse({
    companyId: formValue(formData, "companyId"),
    currency: formValue(formData, "currency"),
    timezone: formValue(formData, "timezone"),
    notificationEmail: formValue(formData, "notificationEmail"),
    defaultServiceRadius: formValue(formData, "defaultServiceRadius"),
  });
  if (!parsed.success) return failFields(parsed.error);

  const access = await requireLogisticsAccess(
    "logistics.company.update",
    parsed.data.companyId,
    `/logistics/${parsed.data.companyId}/settings`,
  );

  await getDatabase().$transaction(async (tx) => {
    await tx.logisticsCompanySettings.upsert({
      where: { companyId: access.companyId },
      create: {
        companyId: access.companyId,
        currency: parsed.data.currency,
        timezone: parsed.data.timezone,
        notificationEmail: parsed.data.notificationEmail ?? null,
        defaultServiceRadius: new Prisma.Decimal(parsed.data.defaultServiceRadius),
      },
      update: {
        currency: parsed.data.currency,
        timezone: parsed.data.timezone,
        notificationEmail: parsed.data.notificationEmail ?? null,
        defaultServiceRadius: new Prisma.Decimal(parsed.data.defaultServiceRadius),
      },
    });
    await recordAuditEvent(tx, {
      actorId: access.actorId,
      action: "LOGISTICS_SETTINGS_UPDATED",
      targetType: "LogisticsCompanySettings",
      targetId: access.companyId,
      metadata: { companyId: access.companyId, currency: parsed.data.currency },
    });
    await appendOutboxEvent(tx, {
      eventType: "logistics.company.settings_updated",
      aggregateType: "LogisticsCompany",
      aggregateId: access.companyId,
      payload: { currency: parsed.data.currency },
    });
  });

  revalidatePath(`/logistics/${access.companyId}/settings`);
  return ok("Settings saved.");
}
