import { z } from "zod";

export const reviewInputSchema = z.object({
  productId: z.uuid({ error: "That object could not be found." }),
  rating: z.coerce
    .number({ error: "Choose a rating." })
    .int({ error: "Choose a whole number of stars." })
    .min(1, { error: "Choose at least one star." })
    .max(5, { error: "Choose at most five stars." }),
  title: z
    .string()
    .trim()
    .min(3, { error: "Give your review a short title." })
    .max(80, { error: "Use 80 characters or fewer." }),
  body: z
    .string()
    .trim()
    .min(20, { error: "Write at least 20 characters." })
    .max(1200, { error: "Use 1200 characters or fewer." }),
});

export type ReviewInput = z.infer<typeof reviewInputSchema>;
