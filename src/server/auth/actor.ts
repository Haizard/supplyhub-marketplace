import type { UserRole, UserStatus, VendorStatus } from "@/generated/prisma/enums";

export interface ActorVendor {
  id: string;
  status: VendorStatus;
}

/**
 * The business the actor is currently acting as. Resolved from PostgreSQL on
 * every session read; only identity is cached in the JWT, never permissions.
 */
export interface ActorBusiness {
  id: string;
  name: string;
  memberId: string;
  vendorId: string | null;
  vendorStatus: VendorStatus | null;
  isOwner: boolean;
}

export interface Actor {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  vendor: ActorVendor | null;
  business?: ActorBusiness | null;
}

export interface OrderAccessResource {
  customerId: string;
  vendorIds: readonly string[];
}

export interface VendorOrderAccessResource {
  vendorId: string;
}
