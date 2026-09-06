// A FoodEvent is one scan. A single scan can be logged against more than
// one profile — the classic case being a parent and a kid sharing the same
// packet — each with their own portion. The LabelExtraction (and its
// per-serving numbers) is shared and stored once; only the portion and the
// "who" vary per consumption record. This is what "carries over vs. doesn't"
// between profiles means in practice:
//   - carries over: the scan itself, the extraction, the misleading-claims
//     analysis — re-scanning the same packet for a second family member is
//     pointless, so this stays shared.
//   - does NOT carry over: portion size, and therefore the actual nutrient
//     amount consumed, and therefore whether it trips that profile's limit —
//     each of those is computed per-consumption, not per-scan.

import type { LabelExtraction } from "@/types/labelExtraction";

export type FoodConsumption = {
  profileId: string;
  // Relative to the label's stated serving size. 1 = one full serving,
  // 0.5 = half, 2 = two servings. Kept as a simple multiplier rather than
  // an absolute gram amount because most labels are read per-serving, and
  // asking a parent to eyeball "0.5 servings" is a much easier UI than
  // asking them to weigh food.
  portionMultiplier: number;
  loggedAt: string; // ISO timestamp
};

export type FoodEvent = {
  id: string;
  extraction: LabelExtraction;
  scannedAt: string; // ISO timestamp
  consumptions: FoodConsumption[];
};

export function createFoodEvent(
  extraction: LabelExtraction,
  firstConsumption: Omit<FoodConsumption, "loggedAt">,
): FoodEvent {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    extraction,
    scannedAt: now,
    consumptions: [{ ...firstConsumption, loggedAt: now }],
  };
}

// Adds a second (or third...) family member's consumption of an *existing*
// scanned food, without re-scanning. This is the "same food, different
// portion" path.
export function addConsumption(
  event: FoodEvent,
  consumption: Omit<FoodConsumption, "loggedAt">,
): FoodEvent {
  return {
    ...event,
    consumptions: [
      ...event.consumptions,
      { ...consumption, loggedAt: new Date().toISOString() },
    ],
  };
}