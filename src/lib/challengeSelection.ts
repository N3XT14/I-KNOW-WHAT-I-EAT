// Which challenge format Learn Mode shows for a given lesson — picked
// randomly among whichever formats actually have enough real data to
// run, rather than a fixed order or a single hardcoded format. As a
// family logs more distinct products, the pool of eligible formats grows
// on its own (rank/odd-one-out need 3+ distinct logged products; the
// others need fewer), so this naturally gets richer over time without
// needing separate "unlock" logic anywhere else.

import type { ChallengeKind } from "@/types/challengeAttempt";

export function availableKinds(eligibleCount: number, hasDecoy: boolean): ChallengeKind[] {
  const kinds: ChallengeKind[] = [];
  if (eligibleCount >= 1) kinds.push("bucket-guess");
  if (eligibleCount >= 1 && hasDecoy) kinds.push("recall-decoy");
  if (eligibleCount >= 3) kinds.push("rank", "odd-one-out");
  return kinds;
}

// Null means nothing is runnable yet — Challenge.tsx shows a "log
// something with this nutrient first" prompt in that case.
export function pickChallengeKind(eligibleCount: number, hasDecoy: boolean): ChallengeKind | null {
  const kinds = availableKinds(eligibleCount, hasDecoy);
  if (kinds.length === 0) return null;
  return kinds[Math.floor(Math.random() * kinds.length)];
}