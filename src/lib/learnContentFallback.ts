// No Gemini call, no network — pure template text over real facts. Used
// when /api/learn-content fails (quota, network, malformed response) so
// Learn Mode never shows an error screen, and for the "always" preview
// while the real generation is in flight.
//
// Angle-aware (v5): which challenge block gets built first now matches
// the card's angle (see lib/lessons.ts), same as the real generation
// path — a "claims" card falls back to a claims challenge, not whatever
// happened to be first in a fixed list, so reliability doesn't come at
// the cost of the card no longer matching what it promised.

import type { LearnFactsPacket } from "@/lib/learnContentPool";
import type { LessonAngle } from "@/types/learnMode";
import type { LearnContentBlock, LearnContentSequence } from "@/types/learnContent";

function storyBlock(facts: LearnFactsPacket): LearnContentBlock {
  const text = facts.hasScanHistory
    ? `${facts.nutrientLabel} adds up fast across a day — the daily limit is ${facts.limit}${facts.unit}. Let's see how what's already been logged stacks up.`
    : `A day's ${facts.nutrientLabel} limit is ${facts.limit}${facts.unit}. Scan a few labels and this gets a lot more concrete.`;
  return { kind: "story", id: "fb-story", text, mascotLine: "Let's take a look!" };
}

function barVsLimitBlock(facts: LearnFactsPacket): LearnContentBlock | null {
  const food = facts.scanFoods[0];
  if (!food) return null;
  return {
    kind: "bar-vs-limit",
    id: "fb-bar",
    difficulty: 1,
    prompt: `Is ${food.productName} over or under the daily ${facts.nutrientLabel} limit?`,
    label: food.productName,
    value: food.value,
    limit: facts.limit,
    unit: facts.unit,
    explanation: `${food.productName} used ${food.percentOfLimit}% of the daily limit.`,
    source: { kind: "scan", foodEventId: food.foodEventId },
  };
}

function rankedListBlock(facts: LearnFactsPacket): LearnContentBlock | null {
  if (facts.scanFoods.length < 3) return null;
  const three = facts.scanFoods.slice(0, 3);
  return {
    kind: "ranked-list",
    id: "fb-rank",
    difficulty: 2,
    prompt: `Rank these from highest to lowest ${facts.nutrientLabel}.`,
    items: three.map((f) => ({ label: f.productName, foodEventId: f.foodEventId, value: f.value })),
    explanation: `Highest first: ${[...three].sort((a, b) => b.value - a.value).map((f) => f.productName).join(", ")}.`,
    source: { kind: "scan", foodEventId: three[0].foodEventId },
  };
}

// Same job as rankedListBlock but for exactly-2-foods, since "compare"
// cards are eligible starting at 2 (see lib/lessons.ts) while the
// ranked-list template needs 3+ to be worth showing as a ranking.
function comparisonBlock(facts: LearnFactsPacket): LearnContentBlock | null {
  if (facts.scanFoods.length < 2) return null;
  const two = facts.scanFoods.slice(0, 2);
  const [a, b] = two;
  const winner = b.value > a.value ? b : a;
  return {
    kind: "comparison",
    id: "fb-compare",
    difficulty: 1,
    prompt: `Which has more ${facts.nutrientLabel}: ${a.productName} or ${b.productName}?`,
    items: two.map((f) => ({ label: f.productName, value: f.value, unit: facts.unit, foodEventId: f.foodEventId })),
    correctLabel: winner.productName,
    explanation: `${winner.productName} used more of the daily ${facts.nutrientLabel} limit (${winner.percentOfLimit}%).`,
    source: { kind: "scan", foodEventId: winner.foodEventId },
  };
}

function spotTheTrickBlock(facts: LearnFactsPacket): LearnContentBlock | null {
  const claim = facts.claims[0];
  if (!claim) return null;
  return {
    kind: "spot-the-trick",
    id: "fb-trick",
    difficulty: 2,
    prompt: `${claim.productName} says "${claim.text}" — is that claim misleading?`,
    claimText: claim.text,
    isMisleading: claim.isMisleading,
    explanation: claim.note,
    source: claim.foodEventId ? { kind: "scan", foodEventId: claim.foodEventId } : { kind: "reference" },
  };
}

function decoyBlock(facts: LearnFactsPacket): LearnContentBlock | null {
  const real = facts.scanFoods[0];
  const decoy = facts.decoyFoods[0];
  if (!real || !decoy) return null;
  return {
    kind: "decoy",
    id: "fb-decoy",
    difficulty: 2,
    prompt: `You've scanned ${real.productName}. Does ${decoy.productName} — which you haven't logged — have more or less ${facts.nutrientLabel}?`,
    real: { label: real.productName, foodEventId: real.foodEventId },
    decoy: { label: decoy.productName, value: decoy.value, unit: decoy.unit },
    explanation:
      decoy.value > real.value
        ? `${decoy.productName} actually has more ${facts.nutrientLabel} than ${real.productName} — it's easy to assume a food you haven't checked is fine.`
        : `${real.productName} has more ${facts.nutrientLabel} than ${decoy.productName} in this case.`,
    source: { kind: "scan", foodEventId: real.foodEventId },
  };
}

function referenceChallenges(facts: LearnFactsPacket): LearnContentBlock[] {
  const pairs = facts.glossary.slice(0, 4);
  if (pairs.length === 0) return [];
  return [
    {
      kind: "matching",
      id: "fb-match",
      difficulty: 1,
      prompt: "Match each label term to what it actually means.",
      pairs: pairs.map((g) => ({ term: g.term, meaning: g.meaning })),
      source: { kind: "reference" },
    },
  ];
}

// Angle-ordered candidate list for the scan-grounded path: the angle's
// own signature block goes first, everything else is fallback filler if
// the primary block can't be built (e.g. a "claims" card whose one
// eligible claim happens to already be used, however unlikely) or if
// there's room for a second, different block.
function scanChallengesForAngle(facts: LearnFactsPacket, angle: LessonAngle): LearnContentBlock[] {
  const byAngle: Record<LessonAngle, (LearnContentBlock | null)[]> = {
    basics: [barVsLimitBlock(facts), rankedListBlock(facts), spotTheTrickBlock(facts)],
    claims: [spotTheTrickBlock(facts), barVsLimitBlock(facts)],
    compare: [rankedListBlock(facts) ?? comparisonBlock(facts), barVsLimitBlock(facts)],
    "hidden-sources": [decoyBlock(facts), barVsLimitBlock(facts)],
  };
  return byAngle[angle].filter((b): b is LearnContentBlock => b !== null);
}

export function buildFallbackSequence(
  lessonId: string,
  facts: LearnFactsPacket,
  angle: LessonAngle = "basics",
): LearnContentSequence {
  // Two challenges is the target; some angle orderings can produce more
  // candidates than that (basics tries 3), so cap it here. The
  // reference-only path already tops out at 1 (matching) — that's the
  // "thin data" case falling back to 1 on its own.
  const challenges = (facts.hasScanHistory ? scanChallengesForAngle(facts, angle) : referenceChallenges(facts)).slice(
    0,
    2,
  );
  return {
    lessonId,
    nutrient: facts.nutrient,
    blocks: [storyBlock(facts), ...challenges],
    generatedAt: new Date().toISOString(),
    isFallback: true,
  };
}
