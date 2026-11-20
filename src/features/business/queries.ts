import "server-only";

import { getDatabase } from "@/server/db/client";

export async function getBusinessById(id: string) {
  return getDatabase().business.findUnique({
    where: { id },
    select: {
      id: true,
      businessCode: true,
      name: true,
      slug: true,
      verificationStatus: true,
      description: true,
      logoKey: true,
      website: true,
      contactPhone: true,
      contactEmail: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { id: true, name: true, slug: true } },
      branches: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          branchCode: true,
          address: true,
          city: true,
          latitude: true,
          longitude: true,
          isPrimary: true,
        },
      },
    },
  });
}

export async function listBusinessesForUser(userId: string) {
  return getDatabase().businessMember.findMany({
    where: { userId, status: "active" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      business: {
        select: {
          id: true,
          businessCode: true,
          name: true,
          slug: true,
          verificationStatus: true,
          logoKey: true,
        },
      },
      roles: {
        select: {
          role: {
            select: {
              id: true,
              name: true,
              isSystem: true,
            },
          },
        },
      },
    },
  });
}

export async function listMembersForBusiness(businessId: string) {
  return getDatabase().businessMember.findMany({
    where: { businessId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      user: {
        select: { id: true, name: true, email: true },
      },
      roles: {
        select: {
          role: { select: { id: true, name: true, isSystem: true } },
        },
      },
    },
  });
}

export async function listRolesForBusiness(businessId: string) {
  return getDatabase().businessRole.findMany({
    where: { businessId },
    orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      isSystem: true,
      permissions: {
        select: {
          permission: { select: { permissionKey: true, description: true } },
        },
      },
    },
  });
}

export async function listAllPermissions() {
  return getDatabase().permission.findMany({
    orderBy: { permissionKey: "asc" },
    select: { id: true, permissionKey: true, description: true },
  });
}
