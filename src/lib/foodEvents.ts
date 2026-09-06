// localStorage-backed food event log. One entry per scan; consumptions
// (who ate it, how much) live inside each event — see types/foodEvent.ts
// for why that's shared rather than duplicated per profile.
//
//   iky-food-events -> FoodEvent[]

import type { FoodEvent } from "@/types/foodEvent";

const FOOD_EVENTS_KEY = "iky-food-events";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getFoodEvents(): FoodEvent[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(FOOD_EVENTS_KEY);
    return raw ? (JSON.parse(raw) as FoodEvent[]) : [];
  } catch {
    return [];
  }
}

export function saveFoodEvent(event: FoodEvent): void {
  if (!isBrowser()) return;
  const events = getFoodEvents();
  events.push(event);
  window.localStorage.setItem(FOOD_EVENTS_KEY, JSON.stringify(events));
}

// Replaces an existing event in place — used when addConsumption() adds a
// second family member's portion to an already-logged scan.
export function updateFoodEvent(event: FoodEvent): void {
  if (!isBrowser()) return;
  const events = getFoodEvents().map((e) => (e.id === event.id ? event : e));
  window.localStorage.setItem(FOOD_EVENTS_KEY, JSON.stringify(events));
}

export function getFoodEventsForProfile(profileId: string): FoodEvent[] {
  return getFoodEvents().filter((e) =>
    e.consumptions.some((c) => c.profileId === profileId),
  );
}