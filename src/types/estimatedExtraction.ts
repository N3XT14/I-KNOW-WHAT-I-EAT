// The "no real label exists" counterpart to LabelExtraction (see
// types/labelExtraction.ts). Used for anything without printed %RDA
// numbers — a home-cooked dish, a loose/unpackaged ingredient, or
// anything else we can only reason about from a photo. Deliberately does
// NOT carry per-nutrient gram amounts or %RDA: we never want this to look
// like a sourced number when it's really the model's best qualitative
// guess. See types/foodItem.ts for how this and LabelExtraction share a
// single FoodEvent shape.

// Purely descriptive context — shown in the UI and fed to the model as a
// hint — never branches the evaluation logic. A "raw ingredient" and a
// "prepared dish" are handled identically once extracted; this only
// changes how it's captioned and what hint we send the model.
export type ItemKind = "prepared_dish" | "raw_ingredient" | "other";

export type WatchLevel = "low" | "moderate" | "high";

export type WatchItem = {
  // Plain-language nutrient area, e.g. "Oil / fat", "Sugar", "Salt" — not
  // constrained to NutrientKey, since this is a qualitative read, not a
  // sourced measurement tied to the app's tracked-limits data model.
  nutrient: string;
  level: WatchLevel;
  // Plain-language reasoning, e.g. "Visibly a lot of oil used for tempering."
  note: string;
};

export type EstimatedExtraction = {
  itemKind: ItemKind;
  // The model's best guess at what this food is, e.g. "Vegetable Pulao".
  // Named the same as LabelExtraction.productName (not "dishName") on
  // purpose — lets shared UI code (History, Instant Check) read one field
  // name regardless of which kind of item it's rendering.
  productName: string | null;
  // Optional context the user typed in before scanning (e.g. "pasta with
  // extra cheese and butter"), echoed back here so it's visible alongside
  // the read that used it.
  userDescription: string | null;
  watchItems: WatchItem[];
  headline: {
    verdict: string;
    drivingFact: string;
  };
};