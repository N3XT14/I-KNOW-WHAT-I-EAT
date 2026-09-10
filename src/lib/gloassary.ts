// Plain-language meanings for terms that actually appear on Indian
// packaged labels — the source material for "matching" challenges and
// for reference-grounded story/quiz content when a profile has no scan
// history yet. Wording here is ours; the terms and what they legally
// mean are FSSAI's (Labelling and Display Regulations, 2020) and the
// %RDA basis already sourced in types/nutrientLimits.ts.

export type GlossaryTerm = {
  term: string;
  meaning: string;
  nutrient?: import("@/types/nutrientLimits").NutrientKey;
};

export const GLOSSARY: GlossaryTerm[] = [
  { term: "%RDA", meaning: "How much of a fixed daily reference amount one serving provides — the reference is a flat 2000kcal adult, not you specifically." },
  { term: "Added Sugar", meaning: "Sugar put in during processing, separate from sugar naturally in an ingredient like fruit or milk.", nutrient: "sugar" },
  { term: "Total Sugars", meaning: "Added sugar plus any naturally occurring sugar, combined into one number.", nutrient: "sugar" },
  { term: "Saturated Fat", meaning: "The type of fat a label calls out separately from Total Fat because eating too much regularly is linked to heart health issues.", nutrient: "saturatedFat" },
  { term: "Trans Fat", meaning: "A fat type formed by processing oil; FSSAI caps it at 2g per day on the standard label basis." },
  { term: "Sodium", meaning: "The nutrient number on a label — not the same as \"salt,\" though the two are related.", nutrient: "sodium" },
  { term: "Salt", meaning: "About 2.5x the sodium amount — some labels print this instead of Sodium.", nutrient: "sodium" },
  { term: "Serving Size", meaning: "The amount all the other numbers on the label are calculated for — often smaller than what people actually eat in one sitting." },
  { term: "Fortified", meaning: "Nutrients were added during processing that weren't naturally in the food to begin with." },
  { term: "No Added Sugar", meaning: "Means no sugar was added during processing — the food can still contain natural sugar and count toward a daily sugar total." },
];

export function glossaryFor(nutrient: string): GlossaryTerm[] {
  return GLOSSARY.filter((g) => g.nutrient === nutrient);
}

export function randomGlossaryPairs(count: number, nutrient?: string): GlossaryTerm[] {
  const pool = nutrient ? GLOSSARY.filter((g) => !g.nutrient || g.nutrient === nutrient) : GLOSSARY;
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}