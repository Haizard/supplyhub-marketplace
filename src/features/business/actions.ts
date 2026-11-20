"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { logger } from "@/lib/logging/logger";
import { recordAuditEvent } from "@/server/audit/audit-log";
import { getSessionActor } from "@/server/auth/session";
import { getDatabase } from "@/server/db/client";
import {
  resolveBusinessContext,
  requirePermission,
  BusinessAccessError,
} from "@/server/business/context";
import { firstFieldErrors, formValue, type FormState } from "@/features/identity/form-state";
import {
  createBusinessSchema,
  updateBusinessSchema,
  createBranchSchema,
  inviteMemberSchema,
  removeMemberSchema,
  createRoleSchema,
  updateRoleSchema,
} from "./validation";

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Generate a short, unique business code like BIZ-A3F9 */
function generateBusinessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "BIZ-";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ── Create business ───────────────────────────────────────────────────────────

export async function createBusinessAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await getSessionActor();
  if (!actor) redirect("/sign-in?next=/business/new");

  const parsed = createBusinessSchema.safeParse({
    name: formValue(formData, "name"),
    slug: formValue(formData, "slug"),
    description: formValue(formData, "description"),
    contactPhone: formValue(formData, "contactPhone"),
    contactEmail: formValue(formData, "contactEmail"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error) };
  }

  const db = getDatabase();

  // Generate a unique business code (retry on collision).
  let business;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateBusinessCode();
    try {
      business = await db.$transaction(async (tx) => {
        const created = await tx.business.create({
          data: {
            businessCode: code,
            name: parsed.data.name,
            slug: parsed.data.slug,
            description: parsed.data.description ?? null,
            contactPhone: parsed.data.contactPhone ?? null,
            contactEmail: parsed.data.contactEmail ?? null,
          },
          select: { id: true, slug: true, businessCode: true },
        });

        // Create system roles: owner and staff.
        const ownerRole = await tx.businessRole.create({
          data: {
            businessId: created.id,
            name: "owner",
            isSystem: true,
          },
          select: { id: true },
        });

        const staffRole = await tx.businessRole.create({
          data: {
            businessId: created.id,
            name: "staff",
            isSystem: true,
          },
          select: { id: true },
        });

        // Grant owner role all permissions.
        const allPermissions = await tx.permission.findMany({
          select: { id: true },
        });

        await tx.rolePermission.createMany({
          data: allPermissions.map((p) => ({
            roleId: ownerRole.id,
            permissionId: p.id,
          })),
        });

        // Grant staff role read and fulfillment permissions.
        const staffPermissions = await tx.permission.findMany({
          where: {
            permissionKey: {
              in: [
                "business.read",
                "branch.read",
                "inventory.read",
                "orders.read",
                "orders.fulfill",
                "catalog.product.create",
                "catalog.product.update",
                "catalog.product.publish",
              ],
            },
          },
          select: { id: true },
        });

        await tx.rolePermission.createMany({
          data: staffPermissions.map((p) => ({
            roleId: staffRole.id,
            permissionId: p.id,
          })),
        });

        // Add the creator as owner member.
        const member = await tx.businessMember.create({
          data: {
            businessId: created.id,
            userId: actor.id,
            status: "active",
          },
          select: { id: true },
        });

        await tx.memberRole.create({
          data: { memberId: member.id, roleId: ownerRole.id },
        });

        // Create a default primary branch.
        await tx.businessBranch.create({
          data: {
            businessId: created.id,
            name: "Main",
            branchCode: "MAIN",
            isPrimary: true,
          },
        });

        // Default settings.
        await tx.businessSettings.create({
          data: { businessId: created.id, settingsJson: {} },
        });

        await recordAuditEvent(tx, {
          actorId: actor.id,
          action: "BUSINESS_CREATED",
          targetType: "business",
          targetId: created.id,
          metadata: { slug: created.slug, businessCode: created.businessCode },
        });

        return created;
      });
      break;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const msg = String((error as Prisma.PrismaClientKnownRequestError).meta?.target ?? "");
        if (msg.includes("business_code") && attempt < 4) continue;
        if (msg.includes("slug")) {
          return {
            status: "error",
            fieldErrors: { slug: "That handle is already taken. Choose another." },
          };
        }
      }
      throw error;
    }
  }

  if (!business) {
    return { status: "error", message: "Could not generate a unique business code. Try again." };
  }

  logger.info("business.created", { actorId: actor.id, businessId: business.id });
  revalidatePath("/business");
  redirect(`/business/${business.id}`);
}

// ── Update business ───────────────────────────────────────────────────────────

export async function updateBusinessAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await getSessionActor();
  if (!actor) return { status: "error", message: "Sign in to continue." };

  const parsed = updateBusinessSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    contactPhone: formValue(formData, "contactPhone"),
    contactEmail: formValue(formData, "contactEmail"),
    website: formValue(formData, "website"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error) };
  }

  try {
    const ctx = await resolveBusinessContext(actor, parsed.data.businessId);
    requirePermission(ctx, "business.update");
  } catch (error) {
    if (error instanceof BusinessAccessError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  const db = getDatabase();

  await db.$transaction(async (tx) => {
    await tx.business.update({
      where: { id: parsed.data.businessId },
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        contactPhone: parsed.data.contactPhone ?? null,
        contactEmail: parsed.data.contactEmail ?? null,
        website: parsed.data.website ?? null,
      },
    });

    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "BUSINESS_UPDATED",
      targetType: "business",
      targetId: parsed.data.businessId,
    });
  });

  logger.info("business.updated", { actorId: actor.id, businessId: parsed.data.businessId });
  revalidatePath(`/business/${parsed.data.businessId}`);
  return { status: "success", message: "Business profile updated." };
}

// ── Create branch ─────────────────────────────────────────────────────────────

export async function createBranchAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await getSessionActor();
  if (!actor) return { status: "error", message: "Sign in to continue." };

  const parsed = createBranchSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    name: formValue(formData, "name"),
    branchCode: formValue(formData, "branchCode"),
    address: formValue(formData, "address"),
    city: formValue(formData, "city"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error) };
  }

  try {
    const ctx = await resolveBusinessContext(actor, parsed.data.businessId);
    requirePermission(ctx, "branch.create");
  } catch (error) {
    if (error instanceof BusinessAccessError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  try {
    await getDatabase().businessBranch.create({
      data: {
        businessId: parsed.data.businessId,
        name: parsed.data.name,
        branchCode: parsed.data.branchCode,
        address: parsed.data.address ?? null,
        city: parsed.data.city ?? null,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        status: "error",
        fieldErrors: { branchCode: "That branch code is already used by another branch." },
      };
    }
    throw error;
  }

  revalidatePath(`/business/${parsed.data.businessId}`);
  return { status: "success", message: "Branch created." };
}

// ── Invite member ─────────────────────────────────────────────────────────────

export async function inviteMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await getSessionActor();
  if (!actor) return { status: "error", message: "Sign in to continue." };

  const parsed = inviteMemberSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    email: formValue(formData, "email"),
    roleName: formValue(formData, "roleName"),
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error) };
  }

  try {
    const ctx = await resolveBusinessContext(actor, parsed.data.businessId);
    requirePermission(ctx, "business.members.manage");
  } catch (error) {
    if (error instanceof BusinessAccessError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  const db = getDatabase();

  const targetUser = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, name: true },
  });

  if (!targetUser) {
    return {
      status: "error",
      fieldErrors: { email: "No account found with that email address." },
    };
  }

  if (targetUser.id === actor.id) {
    return {
      status: "error",
      fieldErrors: { email: "You are already a member of this business." },
    };
  }

  const role = await db.businessRole.findFirst({
    where: { businessId: parsed.data.businessId, name: parsed.data.roleName },
    select: { id: true, name: true, isSystem: true },
  });

  if (!role) {
    return {
      status: "error",
      fieldErrors: { roleName: "That role does not exist for this business." },
    };
  }

  // Prevent granting the owner system role via invite.
  if (role.isSystem && role.name === "owner") {
    return {
      status: "error",
      fieldErrors: { roleName: "The owner role cannot be assigned through an invitation." },
    };
  }

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.businessMember.findUnique({
        where: {
          businessId_userId: { businessId: parsed.data.businessId, userId: targetUser.id },
        },
        select: { id: true, status: true },
      });

      let memberId: string;

      if (existing) {
        if (existing.status === "active") {
          throw new Error("already-member");
        }
        await tx.businessMember.update({
          where: { id: existing.id },
          data: { status: "active", invitedById: actor.id },
        });
        memberId = existing.id;
      } else {
        const created = await tx.businessMember.create({
          data: {
            businessId: parsed.data.businessId,
            userId: targetUser.id,
            status: "active",
            invitedById: actor.id,
          },
          select: { id: true },
        });
        memberId = created.id;
      }

      await tx.memberRole.upsert({
        where: { memberId_roleId: { memberId, roleId: role.id } },
        create: { memberId, roleId: role.id },
        update: {},
      });

      await recordAuditEvent(tx, {
        actorId: actor.id,
        action: "BUSINESS_MEMBER_INVITED",
        targetType: "business",
        targetId: parsed.data.businessId,
        metadata: { invitedUserId: targetUser.id, role: role.name },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "already-member") {
      return {
        status: "error",
        fieldErrors: { email: "That person is already an active member of this business." },
      };
    }
    throw error;
  }

  logger.info("business.member_invited", {
    actorId: actor.id,
    businessId: parsed.data.businessId,
    invitedUserId: targetUser.id,
  });
  revalidatePath(`/business/${parsed.data.businessId}/members`);
  return { status: "success", message: `${targetUser.name} has been added to the business.` };
}

// ── Remove member ─────────────────────────────────────────────────────────────

export async function removeMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await getSessionActor();
  if (!actor) return { status: "error", message: "Sign in to continue." };

  const parsed = removeMemberSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    memberId: formValue(formData, "memberId"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Invalid request." };
  }

  try {
    const ctx = await resolveBusinessContext(actor, parsed.data.businessId);
    requirePermission(ctx, "business.members.manage");
  } catch (error) {
    if (error instanceof BusinessAccessError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  const db = getDatabase();

  const member = await db.businessMember.findFirst({
    where: { id: parsed.data.memberId, businessId: parsed.data.businessId },
    select: {
      id: true,
      userId: true,
      roles: { select: { role: { select: { name: true, isSystem: true } } } },
    },
  });

  if (!member) {
    return { status: "error", message: "That member was not found." };
  }

  // Prevent removing the owner.
  const isOwner = member.roles.some((mr) => mr.role.isSystem && mr.role.name === "owner");
  if (isOwner) {
    return { status: "error", message: "The business owner cannot be removed." };
  }

  // Prevent self-removal via this action.
  if (member.userId === actor.id) {
    return { status: "error", message: "Use account settings to leave a business." };
  }

  await db.$transaction(async (tx) => {
    await tx.businessMember.update({
      where: { id: member.id },
      data: { status: "removed" },
    });

    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "BUSINESS_MEMBER_REMOVED",
      targetType: "business",
      targetId: parsed.data.businessId,
      metadata: { removedUserId: member.userId },
    });
  });

  revalidatePath(`/business/${parsed.data.businessId}/members`);
  return { status: "success", message: "Member removed." };
}

// ── Create role ───────────────────────────────────────────────────────────────

export async function createRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await getSessionActor();
  if (!actor) return { status: "error", message: "Sign in to continue." };

  const permissionKeys = formData
    .getAll("permissionKeys")
    .filter((v): v is string => typeof v === "string");

  const parsed = createRoleSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    name: formValue(formData, "name"),
    permissionKeys,
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error) };
  }

  try {
    const ctx = await resolveBusinessContext(actor, parsed.data.businessId);
    requirePermission(ctx, "business.update");
  } catch (error) {
    if (error instanceof BusinessAccessError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  const db = getDatabase();

  const permissions = await db.permission.findMany({
    where: { permissionKey: { in: parsed.data.permissionKeys } },
    select: { id: true },
  });

  if (permissions.length !== new Set(parsed.data.permissionKeys).size) {
    return { status: "error", fieldErrors: { permissionKeys: "Some permissions are invalid." } };
  }

  try {
    await db.$transaction(async (tx) => {
      const role = await tx.businessRole.create({
        data: { businessId: parsed.data.businessId, name: parsed.data.name },
        select: { id: true },
      });

      await tx.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      });

      await recordAuditEvent(tx, {
        actorId: actor.id,
        action: "BUSINESS_ROLE_CREATED",
        targetType: "business",
        targetId: parsed.data.businessId,
        metadata: { roleName: parsed.data.name },
      });
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        status: "error",
        fieldErrors: { name: "A role with that name already exists." },
      };
    }
    throw error;
  }

  revalidatePath(`/business/${parsed.data.businessId}/roles`);
  return { status: "success", message: "Role created." };
}

// ── Update role ───────────────────────────────────────────────────────────────

export async function updateRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await getSessionActor();
  if (!actor) return { status: "error", message: "Sign in to continue." };

  const permissionKeys = formData
    .getAll("permissionKeys")
    .filter((v): v is string => typeof v === "string");

  const parsed = updateRoleSchema.safeParse({
    businessId: formValue(formData, "businessId"),
    roleId: formValue(formData, "roleId"),
    name: formValue(formData, "name"),
    permissionKeys,
  });

  if (!parsed.success) {
    return { status: "error", fieldErrors: firstFieldErrors(parsed.error) };
  }

  try {
    const ctx = await resolveBusinessContext(actor, parsed.data.businessId);
    requirePermission(ctx, "business.update");
  } catch (error) {
    if (error instanceof BusinessAccessError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }

  const db = getDatabase();

  const role = await db.businessRole.findFirst({
    where: { id: parsed.data.roleId, businessId: parsed.data.businessId },
    select: { id: true, isSystem: true },
  });

  if (!role) return { status: "error", message: "Role not found." };
  if (role.isSystem) {
    return { status: "error", message: "System roles cannot be edited." };
  }

  const permissions = await db.permission.findMany({
    where: { permissionKey: { in: parsed.data.permissionKeys } },
    select: { id: true },
  });

  await db.$transaction(async (tx) => {
    await tx.businessRole.update({
      where: { id: role.id },
      data: { name: parsed.data.name },
    });

    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    await tx.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
    });

    await recordAuditEvent(tx, {
      actorId: actor.id,
      action: "BUSINESS_ROLE_UPDATED",
      targetType: "business",
      targetId: parsed.data.businessId,
      metadata: { roleId: role.id, roleName: parsed.data.name },
    });
  });

  revalidatePath(`/business/${parsed.data.businessId}/roles`);
  return { status: "success", message: "Role updated." };
}
