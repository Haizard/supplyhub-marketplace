import "server-only";

import type { LogisticsCompanyStatus, LogisticsMemberStatus } from "@/generated/prisma/enums";
import { getDatabase } from "@/server/db/client";

export interface LogisticsCompanyView {
  id: string;
  companyCode: string;
  name: string;
  slug: string;
  description: string;
  city: string | null;
  status: LogisticsCompanyStatus;
  plan: string;
  memberCount: number;
  roleCount: number;
  createdAt: string;
}

export interface CompanyMemberView {
  id: string;
  userId: string;
  name: string;
  email: string;
  status: LogisticsMemberStatus;
  joinedAt: string | null;
  roles: { id: string; name: string; isSystem: boolean }[];
}

export interface CompanyRoleView {
  id: string;
  name: string;
  isSystem: boolean;
  description: string;
  permissions: string[];
  memberCount: number;
}

export async function listActorCompanies(userId: string): Promise<LogisticsCompanyView[]> {
  const rows = await getDatabase().logisticsCompany.findMany({
    where: { members: { some: { userId, status: "ACTIVE" } } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      companyCode: true,
      name: true,
      slug: true,
      description: true,
      city: true,
      status: true,
      plan: true,
      createdAt: true,
      _count: { select: { members: true, roles: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    companyCode: row.companyCode,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    city: row.city,
    status: row.status,
    plan: row.plan,
    memberCount: row._count.members,
    roleCount: row._count.roles,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * The public directory behind the logistics marketplace. Anyone can see which
 * approved companies operate here; the company workspace itself stays
 * membership-gated.
 */
export async function listPublicLogisticsCompanies(limit = 24): Promise<LogisticsCompanyView[]> {
  const rows = await getDatabase().logisticsCompany.findMany({
    where: { status: "APPROVED" },
    orderBy: { name: "asc" },
    take: limit,
    select: {
      id: true,
      companyCode: true,
      name: true,
      slug: true,
      description: true,
      city: true,
      status: true,
      plan: true,
      createdAt: true,
      _count: { select: { members: true, roles: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    companyCode: row.companyCode,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    city: row.city,
    status: row.status,
    plan: row.plan,
    memberCount: row._count.members,
    roleCount: row._count.roles,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getLogisticsCompany(companyId: string): Promise<LogisticsCompanyView | null> {
  const row = await getDatabase().logisticsCompany.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      companyCode: true,
      name: true,
      slug: true,
      description: true,
      city: true,
      status: true,
      plan: true,
      createdAt: true,
      _count: { select: { members: true, roles: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    companyCode: row.companyCode,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    city: row.city,
    status: row.status,
    plan: row.plan,
    memberCount: row._count.members,
    roleCount: row._count.roles,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listCompanyMembers(companyId: string): Promise<CompanyMemberView[]> {
  const rows = await getDatabase().logisticsCompanyMember.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      status: true,
      joinedAt: true,
      roles: {
        select: { role: { select: { id: true, name: true, isSystem: true } } },
      },
    },
  });
  const users = await getDatabase().user.findMany({
    where: { id: { in: rows.map((row) => row.userId) } },
    select: { id: true, name: true, email: true },
  });
  const byId = new Map(users.map((user) => [user.id, user]));
  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    name: byId.get(row.userId)?.name ?? "User",
    email: byId.get(row.userId)?.email ?? "",
    status: row.status,
    joinedAt: row.joinedAt?.toISOString() ?? null,
    roles: row.roles.map((assignment) => assignment.role),
  }));
}

export async function listCompanyRoles(companyId: string): Promise<CompanyRoleView[]> {
  const rows = await getDatabase().logisticsCompanyRole.findMany({
    where: { companyId },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      isSystem: true,
      description: true,
      _count: { select: { members: true } },
      permissions: { select: { permission: { select: { permissionKey: true } } } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    isSystem: row.isSystem,
    description: row.description ?? "",
    permissions: row.permissions.map((grant) => grant.permission.permissionKey),
    memberCount: row._count.members,
  }));
}

export interface CompanyBranchView {
  id: string;
  name: string;
  branchCode: string;
  address: string;
  city: string;
  isPrimary: boolean;
  isActive: boolean;
  latitude: string | null;
  longitude: string | null;
}

export interface CompanySettingsView {
  currency: string;
  timezone: string;
  notificationEmail: string | null;
  defaultServiceRadius: string;
}

export interface CompanyActivityView {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  createdAt: string;
}

export async function listCompanyBranches(companyId: string): Promise<CompanyBranchView[]> {
  const rows = await getDatabase().logisticsBranch.findMany({
    where: { companyId },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    branchCode: row.branchCode,
    address: row.address ?? "",
    city: row.city ?? "",
    isPrimary: row.isPrimary,
    isActive: row.isActive,
    latitude: row.latitude?.toString() ?? null,
    longitude: row.longitude?.toString() ?? null,
  }));
}

export async function getCompanySettings(companyId: string): Promise<CompanySettingsView> {
  const row = await getDatabase().logisticsCompanySettings.findUnique({ where: { companyId } });
  return {
    currency: row?.currency ?? "TZS",
    timezone: row?.timezone ?? "Africa/Dar_es_Salaam",
    notificationEmail: row?.notificationEmail ?? null,
    defaultServiceRadius: row?.defaultServiceRadius.toString() ?? "15.000",
  };
}

/** Activity is derived from the existing append-only audit log, not a second journal. */
export async function listCompanyActivity(
  companyId: string,
  limit = 40,
): Promise<CompanyActivityView[]> {
  const rows = await getDatabase().auditLog.findMany({
    where: {
      OR: [
        { targetType: "LogisticsCompany", targetId: companyId },
        {
          targetType: "LogisticsCompanyMember",
          metadata: { path: ["companyId"], equals: companyId },
        },
        {
          targetType: "LogisticsCompanyRole",
          metadata: { path: ["companyId"], equals: companyId },
        },
        { targetType: "LogisticsBranch", metadata: { path: ["companyId"], equals: companyId } },
        {
          targetType: "LogisticsCompanySettings",
          metadata: { path: ["companyId"], equals: companyId },
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, action: true, targetType: true, targetId: true, createdAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function listPendingLogisticsCompanies(): Promise<LogisticsCompanyView[]> {
  const rows = await getDatabase().logisticsCompany.findMany({
    where: { status: "PENDING", submittedAt: { not: null } },
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      companyCode: true,
      name: true,
      slug: true,
      description: true,
      city: true,
      status: true,
      plan: true,
      createdAt: true,
      _count: { select: { members: true, roles: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    companyCode: row.companyCode,
    name: row.name,
    slug: row.slug,
    description: row.description ?? "",
    city: row.city,
    status: row.status,
    plan: row.plan,
    memberCount: row._count.members,
    roleCount: row._count.roles,
    createdAt: row.createdAt.toISOString(),
  }));
}
