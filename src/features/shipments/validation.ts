import { z } from "zod";

export const shipmentSchema = z.object({
  carrier: z
    .string()
    .trim()
    .min(1, { error: "Name the carrier or courier." })
    .max(80, { error: "Use 80 characters or fewer." }),
  trackingNumber: z
    .string()
    .trim()
    .min(1, { error: "Add the tracking number." })
    .max(80, { error: "Use 80 characters or fewer." }),
  trackingUrl: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z
      .url({ error: "Use a full tracking link, starting with https://." })
      .max(500, { error: "Use 500 characters or fewer." })
      .optional(),
  ),
});

export type ShipmentInput = z.infer<typeof shipmentSchema>;
