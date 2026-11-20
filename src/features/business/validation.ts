import { z } from "zod";

const nameField = z
  .string()
  .trim()
  .min(2, { error: "Use at least 2 characters." })
  .max(80, { error: "Use 80 characters or fewer." });

const slugField = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  z
    .string()
    .min(3, { error: "Use at least 3 characters." })
    .max(64, { error: "Use 64 characters or fewer." })
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      error: "Use lowercase letters, numbers, and single hyphens only.",
    }),
);

const optionalText = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().max(500).optional(),
);

export const createBusinessSchema = z.object({
  name: nameField,
  slug: slugField,
  description: optionalText,
  contactPhone: optionalText,
  contactEmail: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.email({ error: "Enter a valid email address." }).optional(),
  ),
});

export const updateBusinessSchema = z.object({
  businessId: z.uuid(),
  name: nameField,
  description: optionalText,
  contactPhone: optionalText,
  contactEmail: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.email({ error: "Enter a valid email address." }).optional(),
  ),
  website: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().url({ error: "Enter a valid URL." }).optional(),
  ),
});

export const createBranchSchema = z.object({
  businessId: z.uuid(),
  name: nameField,
  branchCode: z
    .string()
    .trim()
    .min(2, { error: "Use at least 2 characters." })
    .max(20, { error: "Use 20 characters or fewer." })
    .regex(/^[A-Z0-9-]+$/i, { error: "Use letters, numbers, and hyphens only." })
    .transform((v) => v.toUpperCase()),
  address: optionalText,
  city: optionalText,
});

export const inviteMemberSchema = z.object({
  businessId: z.uuid(),
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.email({ error: "Enter a valid email address." }),
  ),
  roleName: z
    .string()
    .trim()
    .min(1, { error: "Choose a role." })
    .max(50, { error: "Role name too long." }),
});

export const removeMemberSchema = z.object({
  businessId: z.uuid(),
  memberId: z.uuid(),
});

export const createRoleSchema = z.object({
  businessId: z.uuid(),
  name: z
    .string()
    .trim()
    .min(2, { error: "Use at least 2 characters." })
    .max(50, { error: "Use 50 characters or fewer." }),
  permissionKeys: z.array(z.string().min(1)).min(1, { error: "Choose at least one permission." }),
});

export const updateRoleSchema = z.object({
  businessId: z.uuid(),
  roleId: z.uuid(),
  name: z
    .string()
    .trim()
    .min(2, { error: "Use at least 2 characters." })
    .max(50, { error: "Use 50 characters or fewer." }),
  permissionKeys: z.array(z.string().min(1)).min(1, { error: "Choose at least one permission." }),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
