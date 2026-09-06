// Learn Mode: a short lesson (why a nutrient matters) followed by an
// applied challenge that grounds it in a food the family actually scanned —
// not a generic quiz question, but "here's the samosa you scanned Tuesday,
// how much of your sugar limit did that use up?"
//
// Deliberately built against NUTRIENT_LIMITS (placeholder data) rather than
// hardcoded numbers, so swapping in sourced WHO/ICMR-NIN figures later is a
// data change, not a rewrite of this file.

import type { AgeBand } from "@/types/profile";
import { limitFor, type NutrientKey, type NutrientLimit } from "@/types/nutrientLimits";
import type { LabelExtraction } from "@/types/labelExtraction";
import { nutrientAmountFor } from "@/lib/nutrientMatching";

export type Lesson = {
  id: string;
  ageBand: AgeBand | "all";
  nutrientFocus: NutrientKey;
  title: string;
  body: string; // plain-language explainer, a few sentences
};

export type Challenge = {
  id: string;
  lessonId: string;
  prompt: string;
  // The applied challenge is generated against a specific scanned FoodEvent
  // and the active profile's consumption of it — see evaluateChallenge().
};

export type ChallengeResult = {
  challengeId: string;
  profileId: string;
  foodEventId: string;
  nutrient: NutrientKey;
  amountConsumed: number; // in the limit's unit, after portion adjustment
  limit: number;
  percentOfLimit: number;
  passed: boolean; // did answering/reasoning through it go correctly — UI concern, not computed here
};

// Computes how much of a profile's daily limit a single logged consumption
// used up. Portion-adjusted per the FoodConsumption.portionMultiplier, so
// the same FoodEvent shared across two profiles correctly produces two
// different percentages if their portions differ.
export function percentOfLimit(
  nutrientAmountInServing: number,
  portionMultiplier: number,
  limit: number,
): number {
  const consumed = nutrientAmountInServing * portionMultiplier;
  return Math.round((consumed / limit) * 100);
}

export type NutrientEvaluation = {
  nutrient: NutrientKey;
  perServing: number; // as printed on the label, before portion adjustment — the number Learn Mode teaches people to actually read
  amountConsumed: number; // in `unit`, already portion-adjusted (perServing x portionMultiplier)
  limit: number;
  unit: "g" | "mg";
  percentOfLimit: number;
  // Carried straight through from NutrientLimit so screens can render a
  // "Source: ..." tag without a second lookup — every number Learn Mode
  // shows should be traceable to where it came from.
  source: NutrientLimit["source"];
  confidence: NutrientLimit["confidence"];
};

// The function Learn Mode's applied challenge actually calls: given a
// scanned label, a nutrient, a profile's age band, and how much of it they
// had, returns the full picture — or null if either the label doesn't
// print that nutrient (see nutrientAmountFor) or there's no limit defined
// for that age band (shouldn't happen once NUTRIENT_LIMITS covers every
// band, but stays a possibility while the data is still a stub).
export function evaluateNutrientForConsumption(
  extraction: LabelExtraction,
  nutrient: NutrientKey,
  ageBand: AgeBand,
  portionMultiplier: number,
): NutrientEvaluation | null {
  const limit = limitFor(ageBand, nutrient);
  if (!limit) return null;

  const perServing = nutrientAmountFor(extraction.nutrients, nutrient, limit.unit);
  if (perServing === null) return null;

  return {
    nutrient,
    perServing,
    amountConsumed: Math.round(perServing * portionMultiplier * 100) / 100,
    limit: limit.limit,
    unit: limit.unit,
    percentOfLimit: percentOfLimit(perServing, portionMultiplier, limit.limit),
    source: limit.source,
    confidence: limit.confidence,
  };
}