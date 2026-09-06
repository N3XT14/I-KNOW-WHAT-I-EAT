// Bridges what a label actually prints ("Sugar", "Total Sugars", "Sodium",
// sometimes "Salt" instead of Sodium, "12g", "340mg") to the NutrientKey +
// numeric-in-a-known-unit shape NUTRIENT_LIMITS expects. Two separate
// problems, kept as two functions — parsing an amount string into a
// number, and matching a printed name to a NutrientKey — plus one
// composite (nutrientAmountFor) that most callers actually want.

import type { LabelNutrient } from "@/types/labelExtraction";
import type { NutrientKey } from "@/types/nutrientLimits";

export type ParsedAmount = { value: number; unit: "g" | "mg" };

// "12g" -> {value: 12, unit: "g"}; "340mg" -> {value: 340, unit: "mg"}.
// "<1g" -> {value: 1, unit: "g"}: treats a trace amount as its stated
// ceiling. That slightly over-counts rather than under-counts, which is
// the safer direction for a "how close to your limit is this" check.
export function parseNutrientAmount(amount: string): ParsedAmount | null {
  const match = amount.trim().replace(/^</, "").match(/([\d.]+)\s*(mg|g)\b/i);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (Number.isNaN(value)) return null;
  return { value, unit: match[2].toLowerCase() as "g" | "mg" };
}

export function convertTo(parsed: ParsedAmount, targetUnit: "g" | "mg"): number {
  if (parsed.unit === targetUnit) return parsed.value;
  return parsed.unit === "g" ? parsed.value * 1000 : parsed.value / 1000;
}

// Ordered so a more specific line wins when a label prints more than one
// sugar-ish line (e.g. both "Total Sugars" and "Added Sugars") — a "how
// much did you actually eat" check wants the total, not just the added
// portion, so "total" patterns are tried first.
const NAME_PATTERNS: Record<NutrientKey, RegExp[]> = {
  sugar: [/total sugars?/i, /\bsugars?\b/i, /added sugars?/i],
  sodium: [/\bsodium\b/i],
  saturatedFat: [/saturated fat/i, /saturated fatty acids/i],
};

function findByPatterns(nutrients: LabelNutrient[], patterns: RegExp[]): LabelNutrient | null {
  for (const pattern of patterns) {
    const match = nutrients.find((n) => pattern.test(n.name));
    if (match) return match;
  }
  return null;
}

// Indian labels sometimes print "Salt" instead of (or alongside) Sodium.
// Standard conversion: sodium is ~39.3% of salt's mass, commonly rounded
// to sodium(mg) = salt(g) × 400 — that's the widely-used approximation,
// not a sourced-for-this-app figure; fine for a rough "how close to your
// limit" nudge, not precise enough for anything clinical.
const SALT_TO_SODIUM_MG_PER_G = 400;

// Finds the amount for a nutrient key on a label, in targetUnit. Returns
// null when the label simply doesn't print that nutrient (common — not
// every label shows saturated fat) rather than throwing, since "not on
// this label" is an expected, non-error outcome for callers to handle.
export function nutrientAmountFor(
  nutrients: LabelNutrient[],
  key: NutrientKey,
  targetUnit: "g" | "mg",
): number | null {
  const direct = findByPatterns(nutrients, NAME_PATTERNS[key]);
  if (direct) {
    const parsed = parseNutrientAmount(direct.amount);
    return parsed ? convertTo(parsed, targetUnit) : null;
  }

  if (key === "sodium") {
    const salt = findByPatterns(nutrients, [/\bsalt\b/i]);
    if (salt) {
      const parsed = parseNutrientAmount(salt.amount);
      if (!parsed) return null;
      const saltGrams = convertTo(parsed, "g");
      const sodiumMg = saltGrams * SALT_TO_SODIUM_MG_PER_G;
      return targetUnit === "mg" ? sodiumMg : sodiumMg / 1000;
    }
  }

  return null;
}