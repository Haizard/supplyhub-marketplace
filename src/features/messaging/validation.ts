import { z } from "zod";

export const startChatSchema = z.object({
  vendorSlug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Enter a valid studio."),
  productId: z.preprocess((value) => (value === "" ? undefined : value), z.uuid().optional()),
});

export const chatMessageSchema = z.object({
  chatId: z.uuid(),
  body: z
    .string()
    .trim()
    .min(1, "Write a message.")
    .max(2000, "Keep messages under 2000 characters."),
});

export const markReadSchema = z.object({ chatId: z.uuid() });
