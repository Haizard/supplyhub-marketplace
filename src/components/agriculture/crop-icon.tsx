import { Bean, Coffee, Nut, Sprout, Wheat } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const CROP_ICONS: { match: RegExp; icon: LucideIcon }[] = [
  { match: /maize|mais|corn|wheat|rice|sorghum|millet|barley/i, icon: Wheat },
  { match: /bean|pea|lentil|soya|soy|groundnut|nut|cashew|peanut/i, icon: Bean },
  { match: /coffee|cocoa|tea/i, icon: Coffee },
  { match: /avocado|mango|banana|fruit|orange|citrus|tomato/i, icon: Nut },
];

const DEFAULT_CLASS = "size-[46%]";

/** The plate glyph for a crop, picked from the produce name. */
export function cropGlyph(cropName: string, className = DEFAULT_CLASS) {
  const Icon = CROP_ICONS.find((entry) => entry.match.test(cropName))?.icon ?? Sprout;
  return <Icon className={className} strokeWidth={1.25} aria-hidden="true" />;
}
