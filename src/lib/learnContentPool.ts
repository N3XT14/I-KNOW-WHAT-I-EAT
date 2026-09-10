// Turns a profile's real data (or, if they have none yet, the sourced
// reference tables) into the fact packet /api/learn-content is allowed
// to write around. Reuses challengePool.ts's eligibility logic rather
// than re-deriving it — this is the same real data the four original
// challenge components already used, just packaged for a prompt instead
// of a specific UI.

import { isSourced } from "@/types/foodItem";
import type { FoodEvent } from "@/types/foodEvent";
import { currentAgeBand, type Profile } from "@/types/profile";
import { limitFor, type NutrientKey } from "@/types/nutrientLimits";
import { eligibleFoodsForNutrient, decoyCandidates, pickOddOneOutTriple, type EligibleFood } from "@/lib/challengePool";
import { nutrientAmountFor } from "@/lib/nutrientMatching";
import { nutrientLabel } from "@/lib/nutrientLabels";
import { randomGlossaryPairs } from "@/lib/gloassary";
import { SEED_LABELS } from "@/lib/seedLabels";

export type LearnFactsPacket = {
  nutrient: NutrientKey;
  nutrientLabel: string;
  limit: number;
  unit: "g" | "mg";
  hasScanHistory: boolean;
  scanFoods: { foodEventId: string; productName: string; value: number; percentOfLimit: number }[];
  decoyFoods: { productName: string; value: number; unit: "g" | "mg" }[];
  claims: { text: string; isMisleading: boolean; note: string; foodEventId?: string; productName: string }[];
  glossary: { term: string; meaning: string }[];
};

function claimsFromEligible(eligible: EligibleFood[]): LearnFactsPacket["claims"] {
  const claims: LearnFactsPacket["claims"] = [];
  for (const f of eligible) {
    if (!isSourced(f.event.item)) continue;
    for (const c of f.event.item.extraction.claims) {
      claims.push({ text: c.text, isMisleading: c.isMisleading, note: c.note, foodEventId: f.event.id, productName: f.productName });
    }
  }
  return claims;
}

function claimsFromSeeds(nutrient: NutrientKey): LearnFactsPacket["claims"] {
  const claims: LearnFactsPacket["claims"] = [];
  for (const seed of SEED_LABELS) {
    if (!isSourced(seed.item)) continue;
    if (nutrientAmountFor(seed.item.extraction.nutrients, nutrient, "g") === null) continue;
    for (const c of seed.item.extraction.claims) {
      claims.push({ text: c.text, isMisleading: c.isMisleading, note: c.note, productName: seed.title });
    }
  }
  return claims;
}

export function buildFactsPacket(
  profile: Profile,
  events: FoodEvent[],
  nutrient: NutrientKey,
): LearnFactsPacket {
  const ageBand = currentAgeBand(profile.dob);
  const limit = limitFor(ageBand, nutrient, profile.sex);
  const eligible = eligibleFoodsForNutrient(events, profile, nutrient);
  const decoys = decoyCandidates(eligible, nutrient);

  // Well-separated triple first (if one exists) so ranked-list/comparison
  // blocks get genuinely distinguishable foods rather than an arbitrary
  // most-recent-first slice that might all land close in value.
  const separated = pickOddOneOutTriple(eligible)?.items ?? [];
  const separatedIds = new Set(separated.map((f) => f.event.id));
  const rest = eligible.filter((f) => !separatedIds.has(f.event.id));
  const ordered = [...separated, ...rest].slice(0, 8);

  const scanFoods = ordered.map((f) => ({
    foodEventId: f.event.id,
    productName: f.productName,
    value: f.evaluation.amountConsumed,
    percentOfLimit: f.evaluation.percentOfLimit,
  }));

  const decoyFoods = decoys.slice(0, 5).map((d) => {
    if (!isSourced(d.item)) return null;
    const value = nutrientAmountFor(d.item.extraction.nutrients, nutrient, limit.unit);
    return value === null ? null : { productName: d.title, value, unit: limit.unit };
  }).filter((x): x is { productName: string; value: number; unit: "g" | "mg" } => x !== null);

  const claims = eligible.length > 0 ? claimsFromEligible(eligible) : claimsFromSeeds(nutrient);

  return {
    nutrient,
    nutrientLabel: nutrientLabel(nutrient),
    limit: limit.limit,
    unit: limit.unit,
    hasScanHistory: eligible.length > 0,
    scanFoods,
    decoyFoods,
    claims: claims.slice(0, 6),
    glossary: randomGlossaryPairs(6, nutrient),
  };
}

// Every foodEventId a generated block is allowed to reference — used
// server-side to reject any block that cites an id not actually in the
// facts packet (a hallucinated reference), rather than trusting Gemini's
// output blindly.
export function knownFoodEventIds(packet: LearnFactsPacket): Set<string> {
  return new Set(packet.scanFoods.map((f) => f.foodEventId));
}