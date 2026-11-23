import "server-only";

import type { Actor } from "@/server/auth/actor";
import { hasPermission } from "@/server/business/permissions";
import { getDatabase } from "@/server/db/client";

export type LogisticsAccessErrorCode = "not-found" | "not-member" | "suspended" | "forbidden";

export class LogisticsAccessError extends Error {
  readonly code: LogisticsAccessErrorCode;

  constructor(code: LogisticsAccessErrorCode, message: string) {
    super(message);
    this.name = "LogisticsAccessError";
    this.code = code;
  }
}

export interface LogisticsContext {
  actorId: string;
  companyId: string;
  memberId: string;
  permissions: Set<string>;
  isOwner: boolean;
  companyStatus: string;
}

export { hasPermission };

/**
 * Resolves the authenticated user's membership and permissions for a logistics
 * company. Re-reads from PostgreSQL on every request; admins receive all
 * permissions. Only ACTIVE members of non-suspended companies are allowed.
 */
export async function resolveLogisticsContext(
  actor: Actor,
  companyId: string,
): Promise<LogisticsContext> {
  if (actor.role === "ADMIN") {
    return {
      actorId: actor.id,
      companyId,
      memberId: "",
      permissions: new Set(["*"]),
      isOwner: false,
      companyStatus: "APPROVED",
    };
  }

  const database = getDatabase();
  const company = await database.logisticsCompany.findUnique({
    where: { id: companyId },
    select: { id: true, status: true },
  });
  if (!company) {
    throw new LogisticsAccessError("not-found", "That logistics company does not exist.");
  }
  if (company.status === "SUSPENDED" || company.status === "REJECTED") {
    throw new LogisticsAccessError("suspended", "This logistics company is not active.");
  }

  const member = await database.logisticsCompanyMember.findUnique({
    where: { companyId_userId: { companyId, userId: actor.id } },
    select: {
      id: true,
      status: true,
      roles: {
        select: {
          role: {
            select: {
              name: true,
              isSystem: true,
              permissions: {
                select: { permission: { select: { permissionKey: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!member) {
    throw new LogisticsAccessError("not-member", "You are not a member of this company.");
  }
  if (member.status !== "ACTIVE") {
    throw new LogisticsAccessError("suspended", "Your company membership is not active.");
  }

  const permissions = new Set<string>();
  let isOwner = false;
  for (const assignment of member.roles) {
    if (assignment.role.isSystem && assignment.role.name === "owner") {
      isOwner = true;
    }
    for (const grant of assignment.role.permissions) {
      permissions.add(grant.permission.permissionKey);
    }
  }

  return {
    actorId: actor.id,
    companyId,
    memberId: member.id,
    permissions,
    isOwner,
    companyStatus: company.status,
  };
}
