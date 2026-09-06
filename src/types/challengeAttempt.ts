// A ChallengeAttempt is one completed applied-challenge in Learn Mode —
// the record streaks and mastery need to exist at all. Without this,
// every visit to Learn Mode looks like the first, because Challenge.tsx
// computes and displays a result but never persists it (see
// components/learn/Challenge.tsx before this change).
//
// One attempt per guess *submitted*, not per lesson viewed — reading a
// lesson without answering its challenge isn't "practice" for streak
// purposes, only an answered guess is.
//
// Deliberately its own small record (not folded into FoodEvent or
// Profile) because it has a different lifecycle and shape: it's an
// append-only log of learning activity, keyed by day for streaks and by
// nutrient for mastery — neither of which FoodEvent's "what was scanned"
// or Profile's "who is this" shape fits naturally.

import type { NutrientKey } from "@/types/nutrientLimits";

export type ChallengeAttempt = {
  id: string;
  profileId: string;
  lessonId: string;
  // Captured at attempt time rather than looked up later via lessonId ->
  // LESSONS -> nutrientFocus, so mastery-by-nutrient stays correct even
  // if a lesson's nutrientFocus is ever edited or a lesson is removed.
  nutrient: NutrientKey;
  foodEventId: string;
  guessedBucketIndex: number;
  actualBucketIndex: number;
  correct: boolean;
  attemptedAt: string; // ISO timestamp — local calendar day is derived from this for streaks
};

export function createChallengeAttempt(
  attempt: Omit<ChallengeAttempt, "id" | "attemptedAt">,
): ChallengeAttempt {
  return {
    ...attempt,
    id: crypto.randomUUID(),
    attemptedAt: new Date().toISOString(),
  };
}