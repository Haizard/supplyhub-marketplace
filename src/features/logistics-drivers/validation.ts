import { z } from "zod";

const uuid = z.uuid();
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(1).max(max).optional(),
  );
const optionalDate = z.preprocess(
  (v) => (v === "" || v === undefined ? undefined : v),
  z.coerce.date().optional(),
);

export const driverProfileSchema = z.object({
  companyId: uuid,
  fullName: z.string().trim().min(2, "Enter the driver's full name.").max(160),
  phone: optionalText(40),
  licenseNumber: optionalText(80),
  licenseExpiresAt: optionalDate,
  userId: z.preprocess((v) => (v === "" ? undefined : v), uuid.optional()),
});

export const membershipStatusSchema = z.object({
  membershipId: uuid,
  toStatus: z.enum(["ACTIVE", "SUSPENDED", "ENDED"], { error: "Invalid membership status." }),
});

export const employmentSchema = z.object({
  membershipId: uuid,
  type: z.enum(["EMPLOYEE", "CONTRACTOR"]),
  startDate: z.coerce.date(),
  endDate: optionalDate,
  mode: z.enum(["FIXED_MONTHLY", "PER_DELIVERY", "PERCENTAGE", "DAILY", "HYBRID"]),
  amount: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce.number().nonnegative().optional(),
  ),
  rateBps: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    z.coerce.number().int().min(0).max(10000).optional(),
  ),
  notes: optionalText(1000),
});

export const scheduleSchema = z.object({
  membershipId: uuid,
  dayOfWeek: z.coerce.number().int().min(0, "Sunday is day 0.").max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM."),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM."),
  isAvailable: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export const assignmentSchema = z.object({
  membershipId: uuid,
  vehicleId: uuid,
});

export type DriverProfileInput = z.infer<typeof driverProfileSchema>;
export type MembershipStatusInput = z.infer<typeof membershipStatusSchema>;
export type EmploymentInput = z.infer<typeof employmentSchema>;
export type ScheduleInput = z.infer<typeof scheduleSchema>;
export type AssignmentInput = z.infer<typeof assignmentSchema>;
