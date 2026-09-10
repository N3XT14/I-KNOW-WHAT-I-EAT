// No Gemini call, no network — pure template text over real facts. Used
// when /api/learn-content fails (quota, network, malformed response) so
// Learn Mode never shows an error screen, and for the "always" preview
// while the real generation is in flight.

import type { LearnFactsPacket } from "@/lib/learnContentPool";
import type { LearnContentBlock, LearnContentSequence } from "@/types/learnContent";

function storyBlock(facts: LearnFactsPacket): LearnContentBlock {
  const text = facts.hasScanHistory
    ? `${facts.nutrientLabel} adds up fast across a day — the daily limit is ${facts.limit}${facts.unit}. Let's see how what's already been logged stacks up.`
    : `A day's ${facts.nutrientLabel} limit is ${facts.limit}${facts.unit}. Scan a few labels and this gets a lot more concrete.`;
  return { kind: "story", id: "fb-story", text, mascotLine: "Let's take a look!" };
}

function scanChallenges(facts: LearnFactsPacket): LearnContentBlock[] {
  const blocks: LearnContentBlock[] = [];
  const food = facts.scanFoods[0];
  if (food) {
    blocks.push({
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
    });
  }

  if (facts.scanFoods.length >= 3) {
    const three = facts.scanFoods.slice(0, 3);
    blocks.push({
      kind: "ranked-list",
      id: "fb-rank",
      difficulty: 2,
      prompt: `Rank these from highest to lowest ${facts.nutrientLabel}.`,
      items: three.map((f) => ({ label: f.productName, foodEventId: f.foodEventId, value: f.value })),
      explanation: `Highest first: ${[...three].sort((a, b) => b.value - a.value).map((f) => f.productName).join(", ")}.`,
      source: { kind: "scan", foodEventId: three[0].foodEventId },
    });
  }

  const claim = facts.claims[0];
  if (claim) {
    blocks.push({
      kind: "spot-the-trick",
      id: "fb-trick",
      difficulty: 2,
      prompt: `${claim.productName} says "${claim.text}" — is that claim misleading?`,
      claimText: claim.text,
      isMisleading: claim.isMisleading,
      explanation: claim.note,
      source: claim.foodEventId ? { kind: "scan", foodEventId: claim.foodEventId } : { kind: "reference" },
    });
  }

  return blocks;
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

export function buildFallbackSequence(lessonId: string, facts: LearnFactsPacket): LearnContentSequence {
  const challenges = facts.hasScanHistory ? scanChallenges(facts) : referenceChallenges(facts);
  return {
    lessonId,
    nutrient: facts.nutrient,
    blocks: [storyBlock(facts), ...challenges],
    generatedAt: new Date().toISOString(),
    isFallback: true,
  };
}