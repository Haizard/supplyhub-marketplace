import { z } from "zod";

/**
 * Marketplace cover photos are either bundled sample photography under
 * `/public/images` or an uploaded object served by the `/media` route. Only
 * same-origin paths are accepted so listing forms cannot point the storefront
 * at an arbitrary remote host.
 */
export const coverImageUrlSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .trim()
    .max(500)
    .regex(
      /^\/(?:images|media)\/[A-Za-z0-9][A-Za-z0-9/_-]*\.(?:jpe?g|png|webp|avif|gif)$/,
      "Use an image path such as /images/marketplace/avocado.jpg.",
    )
    .optional(),
);
