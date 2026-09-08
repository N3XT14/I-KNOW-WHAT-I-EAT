// A FoodEvent is one scan — of a packaged label OR a home-cooked/unlabeled
// item, see types/foodItem.ts for that fork. A single scan can be logged
// against more than one profile — the classic case being a parent and a
// kid sharing the same packet — each with their own portion. The FoodItem
// (and its per-serving numbers, when it has any) is shared and stored
// once; only the portion and the "who" vary per consumption record. This
// is what "carries over vs. doesn't" between profiles means in practice:
//   - carries over: the scan itself, the extraction, the misleading-claims
//     analysis — re-scanning the same packet for a second family member is
//     pointless, so this stays shared.
//   - does NOT carry over: portion size, and therefore the actual nutrient
//     amount consumed, and therefore whether it trips that profile's limit —
//     each of those is computed per-consumption, not per-scan (and only
//     applies at all to a "sourced" item — see nutrientMatching.ts).

import type { FoodItem } from "@/types/foodItem";

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
  item: FoodItem;
  scannedAt: string; // ISO timestamp
  consumptions: FoodConsumption[];
  // Set when this scan was logged as part of a multi-item Meal (see
  // types/meal.ts) rather than standalone. Optional and additive — a
  // FoodEvent works exactly as before when this is absent.
  mealId?: string;
};

export function createFoodEvent(
  item: FoodItem,
  firstConsumption: Omit<FoodConsumption, "loggedAt">,
): FoodEvent {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    item,
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