// Learn Mode lesson content. Deliberately short and generic (ageBand: "all")
// for v1 — age-differentiated lesson copy is a real future improvement, but
// isn't blocked on the nutrient-limits research the way the numbers are, so
// it's not worth holding up the screens for. Swap in richer/age-specific
// copy later without touching the screens that render this.

import type { Lesson } from "@/types/learnMode";

export const LESSONS: Lesson[] = [
  {
    id: "sugar-basics",
    ageBand: "all",
    nutrientFocus: "sugar",
    title: "Why sugar limits matter",
    body: "Added sugar shows up in foods that don't taste \"sweet\" — sauces, breads, even some namkeen. Your body doesn't need much of it, and eating past the daily limit regularly is linked to weight gain and tooth decay. Checking a label's sugar line before eating is the single fastest habit for catching it.",
  },
  {
    id: "sodium-basics",
    ageBand: "all",
    nutrientFocus: "sodium",
    title: "Salt hides in unexpected places",
    body: "Sodium isn't just table salt — it's in packaged snacks, pickles, and instant foods, often at levels that use up most of a day's limit in one serving. Some labels print \"Salt\" instead of \"Sodium\"; they're related but not the same number, so it's worth knowing which one you're reading.",
  },
  {
    id: "satfat-basics",
    ageBand: "all",
    nutrientFocus: "saturatedFat",
    title: "Not all fat is the same",
    body: "Saturated fat is the kind labels call out separately from \"Total Fat\" because eating too much of it regularly is linked to heart health issues later in life. It's common in fried snacks and bakery items — checking the saturated fat line separately from total fat catches foods that look fine at a glance but aren't.",
  },
];

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}