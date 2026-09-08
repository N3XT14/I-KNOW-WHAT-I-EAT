// Real, sourced nutrient limits — replaces the placeholder. See
// /mnt/user-data/outputs/nutrient-reference-data.md (chat) for the full
// research writeup and primary-source links; this file is the resolved,
// implementation-ready version of that research.
//
// SOURCES (all verified against primary documents, not secondary
// transcriptions — see citations inline below):
//   - ICMR-NIN 2020 energy requirement table (Table 1a), "A Brief Note on
//     Nutrient Requirements for Indians... ICMR-NIN, 2020":
//     https://www.nin.res.in/rdabook/brief_note.pdf
//   - WHO: Saturated fatty acid and trans-fatty acid intake for adults and
//     children (2023) — sat fat <=10% of energy:
//     https://www.who.int/news/item/17-07-2023-who-updates-guidelines-on-fats-and-carbohydrates
//   - WHO: Guideline: sugars intake for adults and children (2015) — free
//     sugars <10% of energy, <5% for additional benefit:
//     https://www.who.int/publications/i/item/9789241549028
//   - WHO: sodium <2000mg/day for adults; for children 2-15y, "adjusting
//     the adult dose downward based on their energy requirements":
//     https://www.who.int/news-room/fact-sheets/detail/sodium-reduction
//   - FSSAI Food Safety and Standards (Labelling and Display) Regulations,
//     2020, Reg 5(3)(b) — the fixed 2000kcal/67g fat/22g sat fat/2g trans
//     fat/50g added sugar/2000mg sodium basis every Indian label's %RDA
//     column is already calculated against:
//     https://fssai.gov.in/upload/uploadfiles/files/Comp_Labelling%20Display_Version%20VIII_09_09_2025.pdf
//
// MODELING DECISIONS (mine, not sourced — flagged so they're easy to
// revisit, not buried as if they were facts):
//
//   1. [Superseded — Profile now has an optional `sex` field, see
//      types/profile.ts.] The energy table below is now genuinely
//      per-sex where ICMR-NIN itself splits it (age 10+). Bands where
//      ICMR-NIN publishes one figure for both sexes (1-3, 4-6, 7-9) stay
//      that way — that's the primary source, not an approximation. When
//      no `sex` is passed (profile hasn't set one), every function below
//      falls back to the average of the two sex-specific figures, which
//      is byte-for-byte the number every profile got before this field
//      existed — so this is a strict precision upgrade, nothing regresses
//      for a profile that skips the (optional) sex question.
//
//   2. WHO states sugar/sat-fat/sodium as %-of-energy or scaled-off-adult
//      rules, not a fixed table — so each row here is *computed* from the
//      ICMR-NIN energy figure for that band via the constants below, not
//      independently sourced per band. Change SUGAR_ENERGY_FRACTION etc.
//      in one place and every row updates consistently.
//
//   3. Sugar uses WHO's <5% "additional benefit" threshold as the actual
//      limit, not the base <10% ceiling — chosen because (a) it's what WHO
//      itself recommends for the strongest health benefit, and (b) it's
//      what the placeholder's own numbers were already implicitly
//      guessing at. The 10% figure is WHO's outer ceiling, not silently
//      discarded — see SUGAR_ENERGY_FRACTION_CEILING if a stricter/looser
//      product decision is wanted later.
//
//   4. Sodium is capped at the adult 2000mg figure even where a teen
//      band's energy need would scale past it — WHO frames the child
//      guidance as scaling *down* from the adult ceiling, so nothing
//      should end up above it.
//
//   5. Fiber, protein, carbs, potassium, trans fat, total fat are in the
//      research writeup but not wired in here — NutrientKey only covers
//      sugar/sodium/saturatedFat because that's all LESSONS and
//      nutrientMatching.ts currently handle. Adding a "good nutrient to
//      praise" (fiber/protein) is a real follow-up, not done here to
//      avoid touching lessons.ts/Challenge.tsx before the screen-design
//      pass.

import type { AgeBand, Sex } from "@/types/profile";

export type NutrientKey = "sugar" | "sodium" | "saturatedFat";

export type NutrientSourceId = "ICMR-NIN-2020" | "WHO" | "FSSAI";

export type NutrientLimit = {
  ageBand: AgeBand;
  nutrient: NutrientKey;
  limit: number;
  unit: "g" | "mg";
  period: "day";
  /** Human-readable citation, safe to render directly in a "Source: ..." tag. */
  source: string;
  /** Structured source list, for UI that wants to render source chips/icons per origin rather than parsing the string. */
  sources: NutrientSourceId[];
  /** Whether this number traces to a verified primary document, or is a modeling decision/estimate layered on top (see decisions 1-4 above). Render differently in the UI so estimated numbers aren't shown with false authority. */
  confidence: "verified" | "estimated";
};

// ICMR-NIN 2020 energy requirement per age band, kcal/day — Table 1a,
// https://www.nin.res.in/rdabook/brief_note.pdf. ICMR-NIN only splits
// this by sex from age 10 up; the three youngest bands publish one figure
// for both, so male/female are deliberately equal there (that equality
// IS the primary source, not a stand-in for a missing split). "adult"
// uses sedentary men/women, matching the same activity-level assumption
// FSSAI's 2000kcal label reference implicitly makes.
const ENERGY_KCAL_PER_DAY_BY_SEX: Record<AgeBand, { male: number; female: number }> = {
  "1-3": { male: 1070, female: 1070 },
  "4-6": { male: 1360, female: 1360 },
  "7-9": { male: 1700, female: 1700 },
  "10-12": { male: 2220, female: 2060 },
  "13-15": { male: 2860, female: 2400 },
  "16-18": { male: 3320, female: 2500 },
  adult: { male: 2110, female: 1660 },
};

// No `sex` -> the average of the two sex-specific figures, i.e. exactly
// the number this file used before the sex field existed. A profile that
// skips the (optional) sex question loses nothing; one that sets it gets
// the real ICMR-NIN figure for their actual sex instead of an average.
function energyFor(ageBand: AgeBand, sex?: Sex): number {
  const { male, female } = ENERGY_KCAL_PER_DAY_BY_SEX[ageBand];
  if (sex === "male") return male;
  if (sex === "female") return female;
  return Math.round((male + female) / 2);
}

// WHO %-of-energy rules — see modeling decision #2-3 above for why sugar
// uses the 5% figure specifically.
const SUGAR_ENERGY_FRACTION = 0.05; // WHO "additional benefit" target
const SUGAR_ENERGY_FRACTION_CEILING = 0.10; // WHO base limit, unused below but kept for an easy product-decision reversal
const SAT_FAT_ENERGY_FRACTION = 0.10; // WHO limit, no stretch goal published
const KCAL_PER_G_SUGAR = 4;
const KCAL_PER_G_SAT_FAT = 9;
const ADULT_SODIUM_CEILING_MG = 2000; // WHO adult limit; children scaled down, never above this (decision #4)

const SUGAR_SOURCE = "WHO (free sugars <5% of energy) scaled to ICMR-NIN 2020 energy requirement for age";
const SAT_FAT_SOURCE = "WHO (saturated fat <=10% of energy) scaled to ICMR-NIN 2020 energy requirement for age";
const SODIUM_SOURCE = "WHO (<2000mg/day adult; scaled down for children per energy need) · ICMR-NIN 2020 energy requirement for age";

function sugarLimitFor(ageBand: AgeBand, sex?: Sex): NutrientLimit {
  const energy = energyFor(ageBand, sex);
  const limit = Math.round((energy * SUGAR_ENERGY_FRACTION) / KCAL_PER_G_SUGAR);
  return {
    ageBand,
    nutrient: "sugar",
    limit,
    unit: "g",
    period: "day",
    source: SUGAR_SOURCE,
    sources: ["WHO", "ICMR-NIN-2020"],
    confidence: "estimated", // the %-fraction choice (decision #3) is a product call layered on verified primary numbers
  };
}

function saturatedFatLimitFor(ageBand: AgeBand, sex?: Sex): NutrientLimit {
  const energy = energyFor(ageBand, sex);
  const limit = Math.round((energy * SAT_FAT_ENERGY_FRACTION) / KCAL_PER_G_SAT_FAT);
  return {
    ageBand,
    nutrient: "saturatedFat",
    limit,
    unit: "g",
    period: "day",
    source: SAT_FAT_SOURCE,
    sources: ["WHO", "ICMR-NIN-2020"],
    confidence: "verified", // straight WHO %, no extra product decision layered on top
  };
}

function sodiumLimitFor(ageBand: AgeBand, sex?: Sex): NutrientLimit {
  // WHO states 2000mg as a direct adult figure, not something itself
  // derived by scaling off a 2000kcal reference — the "scale down from
  // the adult ceiling" instruction applies only to children relative to
  // that adult number. Scaling the adult band's own (lower, sedentary)
  // energy would undershoot 2000mg, which would misstate WHO's guidance.
  // So "adult" always gets the flat ceiling; only child bands scale.
  let limit: number;
  if (ageBand === "adult") {
    limit = ADULT_SODIUM_CEILING_MG;
  } else {
    const energy = energyFor(ageBand, sex);
    const scaled = Math.round(ADULT_SODIUM_CEILING_MG * (energy / 2000));
    limit = Math.min(scaled, ADULT_SODIUM_CEILING_MG);
  }
  return {
    ageBand,
    nutrient: "sodium",
    limit,
    unit: "mg",
    period: "day",
    source: SODIUM_SOURCE,
    sources: ["WHO", "ICMR-NIN-2020"],
    confidence: ageBand === "adult" ? "verified" : "estimated", // the scale-and-cap interpretation (decision #4) for children is mine, not a WHO-published number
  };
}

const AGE_BANDS: AgeBand[] = ["1-3", "4-6", "7-9", "10-12", "13-15", "16-18", "adult"];

// Sex-averaged table, kept for any caller that doesn't have a specific
// profile's sex on hand (or explicitly wants the pre-sex-field numbers).
// Byte-for-byte what this file returned before the sex field existed.
export const NUTRIENT_LIMITS: NutrientLimit[] = [
  ...AGE_BANDS.map((b) => sugarLimitFor(b)),
  ...AGE_BANDS.map((b) => sodiumLimitFor(b)),
  ...AGE_BANDS.map((b) => saturatedFatLimitFor(b)),
];

// FSSAI's fixed label-reference basis — Reg 5(3)(b) of the FSS (Labelling
// and Display) Regulations, 2020. This is NOT a per-age-band limit; it's
// the single 2000kcal-adult denominator every packaged label's "%RDA"
// column is already computed against, regardless of who's eating it.
// Exposed separately so Learn Mode/Instant Check can show "the label
// assumes X, but for you specifically it's Y" as an explicit teaching
// moment rather than silently using one or the other.
export const FSSAI_LABEL_BASIS = {
  energyKcal: 2000,
  totalFatG: 67,
  saturatedFatG: 22,
  transFatG: 2,
  addedSugarG: 50,
  sodiumMg: 2000,
  source: "FSSAI Food Safety and Standards (Labelling and Display) Regulations, 2020, Regulation 5(3)(b)",
} as const;

// `sex` is optional and threaded all the way from Profile — pass it
// whenever it's available (see types/learnMode.ts) to get the real
// ICMR-NIN figure for that band/sex instead of the sex-averaged fallback.
export function limitFor(ageBand: AgeBand, nutrient: NutrientKey, sex?: Sex): NutrientLimit {
  if (nutrient === "sugar") return sugarLimitFor(ageBand, sex);
  if (nutrient === "saturatedFat") return saturatedFatLimitFor(ageBand, sex);
  return sodiumLimitFor(ageBand, sex);
}

// The nutrients Learn Mode / Instant Check / the profile summary track —
// shared here so every screen that needs "all tracked nutrients" pulls
// from one list instead of each redefining it locally and risking drift.
export const TRACKED_NUTRIENT_KEYS: NutrientKey[] = ["sugar", "sodium", "saturatedFat"];