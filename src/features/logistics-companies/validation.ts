import { z } from "zod";

import { coverImageUrlSchema } from "@/features/marketplaces/images";

const uuid = z.uuid();

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).max(max).optional(),
  );

export const companySchema = z.object({
  name: z.string().trim().min(2, "Company name is too short.").max(150),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes."),
  registrationNumber: optionalText(80),
  description: optionalText(2000),
  contactPhone: optionalText(40),
  contactEmail: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.email().max(160).optional(),
  ),
  address: optionalText(300),
  city: optionalText(120),
  coverImageUrl: coverImageUrlSchema,
  countryCode: z
    .string()
    .trim()
    .length(2)
    .regex(/^[A-Z]{2}$/, "Use a two-letter country code.")
    .default("TZ"),
});

export const companyReviewSchema = z.object({
  companyId: uuid,
  decision: z.enum(["APPROVED", "REJECTED"], { error: "Choose a decision." }),
  note: z.string().trim().max(1000).optional(),
});

export const memberInviteSchema = z.object({
  companyId: uuid,
  email: z.email({ error: "Enter a valid email address." }),
  roleIds: z.array(uuid).min(1, "Assign at least one role.").max(10),
});

export const memberStatusSchema = z.object({
  memberId: uuid,
  toStatus: z.enum(["ACTIVE", "SUSPENDED"], { error: "Invalid member status." }),
});

export const roleSchema = z.object({
  companyId: uuid,
  name: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[A-Za-z0-9 ]+$/, "Use letters, numbers and spaces only."),
  description: optionalText(300),
  permissionKeys: z
    .array(z.string().regex(/^logistics\.[a-z.]+$/, "Only logistics permissions are allowed."))
    .min(1, "Select at least one permission.")
    .max(20),
});

export const assignRoleSchema = z.object({
  memberId: uuid,
  roleId: uuid,
});

export const companyUpdateSchema = companySchema.extend({
  companyId: uuid,
});

export const branchSchema = z.object({
  branchId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
  companyId: uuid,
  name: z.string().trim().min(2, "Branch name is too short.").max(120),
  branchCode: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Z0-9-]+$/, "Use uppercase letters, numbers and dashes."),
  address: optionalText(300),
  city: optionalText(120),
  latitude: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce.number().min(-90).max(90).optional(),
  ),
  longitude: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce.number().min(-180).max(180).optional(),
  ),
  isPrimary: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  isActive: z.preprocess(
    (v) => v === undefined || v === "on" || v === "true" || v === true,
    z.boolean(),
  ),
});

export const settingsSchema = z.object({
  companyId: uuid,
  currency: z
    .string()
    .trim()
    .length(3)
    .regex(/^[A-Z]{3}$/, "Use a three-letter currency code."),
  timezone: z.string().trim().min(1).max(64),
  notificationEmail: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.email().optional(),
  ),
  defaultServiceRadius: z.coerce
    .number()
    .min(0, "Radius cannot be negative.")
    .max(1000, "Radius is too large."),
});

export type CompanyInput = z.infer<typeof companySchema>;
export type CompanyUpdateInput = z.infer<typeof companyUpdateSchema>;
export type BranchInput = z.infer<typeof branchSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type CompanyReviewInput = z.infer<typeof companyReviewSchema>;
export type MemberInviteInput = z.infer<typeof memberInviteSchema>;
export type MemberStatusInput = z.infer<typeof memberStatusSchema>;
export type RoleInput = z.infer<typeof roleSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;

export const LOGISTICS_PERMISSION_KEYS = [
  "logistics.company.read",
  "logistics.company.update",
  "logistics.fleet.manage",
  "logistics.fleet.share",
  "logistics.driver.manage",
  "logistics.driver.view",
  "logistics.dispatch.manage",
  "logistics.client.manage",
  "logistics.contract.manage",
  "logistics.finance.read",
  "logistics.finance.approve",
  "logistics.referral.manage",
] as const;
