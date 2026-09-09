// Turns a profile's real scan/consumption history into material for
// Learn Mode's challenge formats — the thing that makes "rank these
// foods" or "spot the outlier" use actually-logged foods instead of
// invented quiz content. One place for this so every challenge component
// (BucketGuessChallenge, RankChallenge, OddOneOutChallenge,
// RecallDecoyChallenge) reads eligibility the same way rather than each
// re-deriving it slightly differently.

import { isSourced, itemTitle } from "@/types/foodItem";
import type { FoodEvent } from "@/types/foodEvent";
import { currentAgeBand, type Profile } from "@/types/profile";
import { evaluateNutrientForConsumption, type NutrientEvaluation } from "@/types/learnMode";
import type { NutrientKey } from "@/types/nutrientLimits";
import { nutrientAmountFor } from "@/lib/nutrientMatching";
import { SEED_LABELS, type SeedItem } from "@/lib/seedLabels";

export type EligibleFood = {
  event: FoodEvent;
  evaluation: NutrientEvaluation;
  productName: string;
};

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sameIdSet(a: string[], b: string[] | null | undefined): boolean {
  if (!b) return false;
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((id) => setB.has(id));
}

// All of this profile's logged sourced foods that print the given
// nutrient, most-recent first, deduped by product name (keeping the most
// recent scan of each) — so a rank/odd-one-out challenge never shows the
// same product twice just because it was logged more than once.
export function eligibleFoodsForNutrient(
  events: FoodEvent[],
  profile: Profile,
  nutrient: NutrientKey,
): EligibleFood[] {
  const ageBand = currentAgeBand(profile.dob);
  const sorted = [...events].sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
  const seenNames = new Set<string>();
  const results: EligibleFood[] = [];

  for (const event of sorted) {
    if (!isSourced(event.item)) continue;
    const consumption = event.consumptions.find((c) => c.profileId === profile.id);
    if (!consumption) continue;

    const name = itemTitle(event.item) ?? event.id;
    const key = name.toLowerCase();
    if (seenNames.has(key)) continue;

    const evaluation = evaluateNutrientForConsumption(
      event.item.extraction,
      nutrient,
      ageBand,
      consumption.portionMultiplier,
      profile.sex,
    );
    if (!evaluation) continue;

    seenNames.add(key);
    results.push({ event, evaluation, productName: name });
  }

  return results;
}

// Picks 3 eligible foods for the rank challenge. `avoidIds`, if given, is
// the id set last shown for this lesson+profile (see
// lib/challengeHistory.ts) — retries the shuffle a handful of times to
// avoid exactly repeating it when the pool is large enough to offer a
// different trio. With eligible.length <= 3 there's only one possible
// trio, so no amount of retrying can avoid a repeat.
export function pickRankTriple(eligible: EligibleFood[], avoidIds?: string[] | null): EligibleFood[] {
  if (eligible.length <= 3) return shuffled(eligible).slice(0, 3);
  for (let attempt = 0; attempt < 8; attempt++) {
    const picked = shuffled(eligible).slice(0, 3);
    if (!sameIdSet(picked.map((p) => p.event.id), avoidIds)) return picked;
  }
  return shuffled(eligible).slice(0, 3);
}

// Picks a triple for "spot the outlier": one food whose percentOfLimit is
// clearly separated from the other two, which sit close together —
// rather than three random picks that might all land close in value and
// make for an ambiguous, unfair challenge. Scans a capped random pool
// (not the full eligible list) so this stays cheap even with a long scan
// history.
//
// `avoidIds` (see lib/challengeHistory.ts) is the id set last shown for
// this lesson+profile — among every valid candidate triple, this prefers
// the best-scoring one that isn't an exact repeat, rather than randomly
// retrying (which could throw away a clearly-best triple for a weaker
// one just to dodge a repeat). Falls back to the single best candidate
// if every candidate happens to be the same repeat (small pool).
export function pickOddOneOutTriple(
  eligible: EligibleFood[],
  avoidIds?: string[] | null,
): { items: EligibleFood[]; outlierId: string } | null {
  if (eligible.length < 3) return null;

  const pool = shuffled(eligible).slice(0, Math.min(eligible.length, 6));
  const candidates: { items: EligibleFood[]; outlierId: string; score: number }[] = [];

  for (let i = 0; i < pool.length; i++) {
    const rest = pool.filter((_, idx) => idx !== i);
    for (let a = 0; a < rest.length; a++) {
      for (let b = a + 1; b < rest.length; b++) {
        const outlier = pool[i];
        const x = rest[a];
        const y = rest[b];
        const closeness = Math.abs(x.evaluation.percentOfLimit - y.evaluation.percentOfLimit);
        const gap = Math.min(
          Math.abs(outlier.evaluation.percentOfLimit - x.evaluation.percentOfLimit),
          Math.abs(outlier.evaluation.percentOfLimit - y.evaluation.percentOfLimit),
        );
        candidates.push({
          items: shuffled([outlier, x, y]),
          outlierId: outlier.event.id,
          score: gap - closeness,
        });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);

  const nonRepeat = candidates.find((c) => !sameIdSet(c.items.map((i) => i.event.id), avoidIds));
  const chosen = nonRepeat ?? candidates[0];
  return { items: chosen.items, outlierId: chosen.outlierId };
}

// Seed-library products that could stand in as the "not actually logged"
// option in a recall-vs-decoy challenge: they print the nutrient in
// question (so the pairing is plausible) and aren't a product this
// profile has genuinely logged (so the correct answer isn't ambiguous).
// Real nutrition data throughout — nothing here is invented, it's just
// data the profile didn't personally generate.
export function decoyCandidates(eligible: EligibleFood[], nutrient: NutrientKey): SeedItem[] {
  const loggedNames = new Set(eligible.map((e) => e.productName.toLowerCase()));
  return SEED_LABELS.filter((seed) => {
    if (!isSourced(seed.item)) return false;
    if (loggedNames.has(seed.title.toLowerCase())) return false;
    return nutrientAmountFor(seed.item.extraction.nutrients, nutrient, "g") !== null;
  });
}