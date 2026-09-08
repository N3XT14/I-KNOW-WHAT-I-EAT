// A Meal doesn't change how any individual item is scanned, extracted, or
// scored — it's just a grouping on top: "these FoodEvents were eaten
// together." Purely additive: a FoodEvent with no mealId behaves exactly
// as it always has, and nothing about nutrient evaluation, streaks, or
// mastery reads Meal at all (that's all still per-FoodEvent/per-item).
// Meal exists for History to be able to show "Lunch: rice + dal + pickle"
// as one card instead of three unrelated ones, and to let someone build
// that up by adding items one scan at a time rather than requiring every
// item to be captured in a single flow.

export type Meal = {
  id: string;
  // User-editable, e.g. "Lunch" — optional since not everyone will bother
  // naming it, and an unnamed meal is still useful as a grouping.
  label: string | null;
  loggedAt: string; // ISO timestamp, when the meal was first created
  // FoodEvent ids belonging to this meal, in the order they were added.
  // The FoodEvents themselves live in the normal food-events store (see
  // lib/foodEvents.ts) — this only holds the grouping.
  foodEventIds: string[];
};

export function createMeal(label: string | null, firstFoodEventId: string): Meal {
  return {
    id: crypto.randomUUID(),
    label,
    loggedAt: new Date().toISOString(),
    foodEventIds: [firstFoodEventId],
  };
}

export function addFoodEventToMeal(meal: Meal, foodEventId: string): Meal {
  if (meal.foodEventIds.includes(foodEventId)) return meal;
  return { ...meal, foodEventIds: [...meal.foodEventIds, foodEventId] };
}