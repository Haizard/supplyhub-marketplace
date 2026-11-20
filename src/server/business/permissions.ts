/**
 * Pure permission helpers for the business identity model.
 *
 * Deliberately free of database imports so the authorization rules can be
 * unit tested without a PostgreSQL connection.
 */

export interface BusinessContext {
  businessId: string;
  memberId: string;
  permissions: Set<string>;
  isOwner: boolean;
}

export type BusinessAccessErrorCode = "not-found" | "not-member" | "suspended" | "forbidden";

export class BusinessAccessError extends Error {
  readonly code: BusinessAccessErrorCode;

  constructor(code: BusinessAccessErrorCode, message: string) {
    super(message);
    this.name = "BusinessAccessError";
    this.code = code;
  }
}

/**
 * Returns true if the context grants the requested permission.
 * Admin contexts (permissions = Set(['*'])) always return true.
 */
export function hasPermission(ctx: BusinessContext, key: string): boolean {
  return ctx.permissions.has("*") || ctx.permissions.has(key);
}

/**
 * Throws if the context does not have the requested permission.
 */
export function requirePermission(ctx: BusinessContext, key: string): void {
  if (!hasPermission(ctx, key)) {
    throw new BusinessAccessError(
      "forbidden",
      `You do not have the '${key}' permission for this business.`,
    );
  }
}
