import { z } from "zod";

const uuid = z.uuid();

export const opportunitySchema = z.object({
  requestId: uuid,
  vehicleType: z.enum(["BICYCLE", "MOTORCYCLE", "CAR", "VAN", "TRUCK"]).optional(),
  expiresAt: z.coerce.date(),
  note: z.string().trim().max(1000).optional(),
});

export const offerSchema = z.object({
  opportunityId: uuid,
  companyId: uuid,
});

export const declineSchema = z.object({
  opportunityId: uuid,
  reason: z.string().trim().min(3, "Explain why you declined.").max(1000),
});

export const expirySchema = z.object({
  opportunityId: uuid,
});
