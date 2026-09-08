// The single response shape for /api/scan. There is deliberately no
// "which mode was this" flag from the client — Gemini looks at the actual
// photo and decides whether a real printed label is visible (-> FoodItem
// kind "sourced") or not (-> kind "estimated"). See types/foodItem.ts for
// that fork; this type is just the wire shape around it.

import type { FoodItem } from "@/types/foodItem";

export type ScanApiResponse =
  | {
      ok: true;
      item: FoodItem;
      // Set when the model notices more than one distinct food item in
      // the photo (a thali, a plate with several things on it). We don't
      // attempt to split multi-item photos apart — accuracy on a single
      // extraction covering several different foods would be
      // meaningfully worse — so this is a nudge to rescan items
      // separately (and use Meal mode to group them), not a partial
      // multi-item result.
      multipleItemsNote: string | null;
    }
  | { ok: false; error: string };