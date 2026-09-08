// What we ask the vision model to pull off a real Indian packaged-food
// label. Kept deliberately flat/simple for v1 — one serving's worth of
// numbers plus the handful of claims that are usually the misleading part.

export type LabelNutrient = {
  name: string; // "Sugar", "Sodium", "Total Fat", etc — as printed
  amount: string; // "12g", "340mg" — kept as printed, not parsed to a number
  percentDailyValue: number | null; // %RDA if the label shows one, else null
};

export type LabelClaim = {
  text: string; // e.g. "No Added Sugar", "Immunity Booster"
  isMisleading: boolean; // true if the claim doesn't match the nutrient panel
  note: string; // one line explaining why, in plain language
};

export type LabelExtraction = {
  productName: string | null;
  servingSize: string | null;
  nutrients: LabelNutrient[];
  claims: LabelClaim[];
  // The single most important number to lead with in Instant Check —
  // the model picks whichever nutrient/claim mismatch matters most for
  // a parent glancing at this for 5 seconds.
  headline: {
    verdict: string; // "High in sugar" / "Reasonably balanced" / etc
    drivingFact: string; // "12g sugar — about 3 teaspoons" — the "why"
  };
};