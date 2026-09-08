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

export function getFoodEvent(id: string): FoodEvent | null {
  return getFoodEvents().find((e) => e.id === id) ?? null;
}

// Looks up several events by id at once, preserving the given order and
// silently dropping any id that no longer resolves (e.g. cleared
// localStorage) — used to join a Meal's foodEventIds back to real events.
export function getFoodEventsByIds(ids: string[]): FoodEvent[] {
  const all = getFoodEvents();
  return ids
    .map((id) => all.find((e) => e.id === id))
    .filter((e): e is FoodEvent => e !== undefined);
}