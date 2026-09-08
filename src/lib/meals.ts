// localStorage-backed meal log. Same convention as lib/foodEvents.ts.
//
//   iky-meals -> Meal[]

import type { Meal } from "@/types/meal";

const MEALS_KEY = "iky-meals";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getMeals(): Meal[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(MEALS_KEY);
    return raw ? (JSON.parse(raw) as Meal[]) : [];
  } catch {
    return [];
  }
}

export function saveMeal(meal: Meal): void {
  if (!isBrowser()) return;
  const meals = getMeals();
  meals.push(meal);
  window.localStorage.setItem(MEALS_KEY, JSON.stringify(meals));
}

// Replaces an existing meal in place — used when addFoodEventToMeal()
// appends another item to a meal that's already in progress.
export function updateMeal(meal: Meal): void {
  if (!isBrowser()) return;
  const meals = getMeals().map((m) => (m.id === meal.id ? meal : m));
  window.localStorage.setItem(MEALS_KEY, JSON.stringify(meals));
}

export function getMeal(id: string): Meal | null {
  return getMeals().find((m) => m.id === id) ?? null;
}

// The single in-progress meal, if any — persisted (not just React state)
// so it survives navigating away from the scan page and back, or the page
// remounting. This is what "one meal at a time" actually means in
// practice: there's exactly one slot, set here, and it's cleared by
// finishing the meal — never implicitly by leaving the page.
const ACTIVE_MEAL_KEY = "iky-active-meal-id";

export function getActiveMealId(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(ACTIVE_MEAL_KEY);
}

export function setActiveMealId(id: string | null): void {
  if (!isBrowser()) return;
  if (id) window.localStorage.setItem(ACTIVE_MEAL_KEY, id);
  else window.localStorage.removeItem(ACTIVE_MEAL_KEY);
}