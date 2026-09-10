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
//
// A discriminated union on `kind` rather than one flat shape — different
// challenge formats (rank, odd-one-out, recall-vs-decoy) capture
// genuinely different guess data, and streaks.ts / masteryByNutrient only
// ever read the shared base fields (nutrient, correct, attemptedAt), so
// widening this to a union doesn't touch that math at all. See
// lib/challengeAttempts.ts for how attempts saved before this union
// existed (all bucket-guess) are read back safely.

import type { NutrientKey } from "@/types/nutrientLimits";

export type ChallengeKind = "bucket-guess" | "rank" | "odd-one-out" | "recall-decoy";

type BaseAttempt = {
  id: string;
  profileId: string;
  lessonId: string;
  // Captured at attempt time rather than looked up later via lessonId ->
  // LESSONS -> nutrientFocus, so mastery-by-nutrient stays correct even
  // if a lesson's nutrientFocus is ever edited or a lesson is removed.
  nutrient: NutrientKey;
  correct: boolean;
  attemptedAt: string; // ISO timestamp — local calendar day is derived from this for streaks
};

// The original format: guess which %-of-daily-limit bucket a single
// logged food fell into.
export type BucketGuessAttempt = BaseAttempt & {
  kind: "bucket-guess";
  foodEventId: string;
  guessedBucketIndex: number;
  actualBucketIndex: number;
};

// Tap three real logged foods in order, highest nutrient first.
export type RankAttempt = BaseAttempt & {
  kind: "rank";
  foodEventIds: string[]; // the three shown, in display (shuffled) order
  guessedOrder: string[]; // foodEventIds in the order tapped
  actualOrder: string[]; // foodEventIds in the correct order
};

// Three real logged foods, one a clear outlier on the nutrient — spot it.
export type OddOneOutAttempt = BaseAttempt & {
  kind: "odd-one-out";
  foodEventIds: string[];
  guessedOutlierId: string;
  actualOutlierId: string;
};

// A real logged food vs. a similar-sounding item from the seed library
// that was never actually scanned — tests recall of what was really
// eaten, not nutrition knowledge.
export type RecallDecoyAttempt = BaseAttempt & {
  kind: "recall-decoy";
  realFoodEventId: string;
  decoyProductName: string;
  guessedId: string; // whichever option (real event id or decoy id) was tapped
};

// One shared kind for every generated-block challenge (quiz-mc,
// comparison, bar-vs-limit, ranked-list, decoy, spot-the-trick) — they
// all reduce to "guessed X, was it right", and streaks/mastery only ever
// read the shared base fields, so a kind-per-block-type union like the
// original four formats have isn't worth the extra code here. "story"
// and "matching" have no single right/wrong answer, so they're never
// logged as attempts.
export type GeneratedAttempt = BaseAttempt & {
  kind: "generated";
  blockKind: string;
  blockId: string;
};

export type ChallengeAttempt =
  | BucketGuessAttempt
  | RankAttempt
  | OddOneOutAttempt
  | RecallDecoyAttempt
  | GeneratedAttempt;

// Generic over the specific member so callers get full type-checking on
// the kind-specific fields — `Omit` over a union collapses to only the
// shared base fields, so a plain (non-generic) signature here would
// silently lose that checking.
export function createChallengeAttempt<T extends ChallengeAttempt>(
  attempt: Omit<T, "id" | "attemptedAt">,
): T {
  return {
    ...attempt,
    id: crypto.randomUUID(),
    attemptedAt: new Date().toISOString(),
  } as T;
}