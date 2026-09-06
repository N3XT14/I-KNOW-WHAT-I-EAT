// Streak and mastery math, computed purely from a profile's
// ChallengeAttempt list. Deliberately takes attempts as a plain array
// rather than reading localStorage itself, so it stays a pure function —
// callers (a future streak badge, a progress screen, tests) pass in
// getChallengeAttemptsForProfile(id) themselves.

import type { ChallengeAttempt } from "@/types/challengeAttempt";
import type { NutrientKey } from "@/types/nutrientLimits";

// Local calendar-day key (YYYY-MM-DD) using the device's own timezone —
// this is a client-only, localStorage-only app with no server, so "local"
// here correctly means the same thing as "the day it felt like to the
// person doing the challenge," which is what a daily habit streak should
// track. (Date.toISOString() would use UTC and can land on the wrong day
// for anyone not near UTC+0 — deliberately not used here.)
function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// A "streak day" = at least one challenge attempt logged that calendar
// day, correct or not — attempting is the habit being tracked here;
// getting the answer right is a separate signal (see masteryFor below).
//
// The streak doesn't break just because today has no attempt *yet*: if
// yesterday had one and today doesn't (so far), the streak is still
// "alive" at yesterday's count, not reset to 0 — someone checking their
// streak first thing in the morning shouldn't see it wiped before they've
// had a chance to do today's challenge.
export function currentStreak(attempts: ChallengeAttempt[], on: Date = new Date()): number {
  const days = new Set(attempts.map((a) => localDateKey(new Date(a.attemptedAt))));
  if (days.size === 0) return 0;

  const cursor = new Date(on.getFullYear(), on.getMonth(), on.getDate());
  if (!days.has(localDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (days.has(localDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function attemptedToday(attempts: ChallengeAttempt[], on: Date = new Date()): boolean {
  const today = localDateKey(on);
  return attempts.some((a) => localDateKey(new Date(a.attemptedAt)) === today);
}

export type NutrientMastery = {
  nutrient: NutrientKey;
  attempted: number;
  correct: number;
  // null rather than 0 when attempted is 0 — "0% accuracy" and "never
  // tried" are different states and a progress UI shouldn't conflate them
  // (e.g. showing a red 0% for a nutrient nobody has attempted yet).
  accuracy: number | null;
};

// One row per nutrient that has at least one attempt logged — a nutrient
// with zero attempts simply doesn't appear, rather than appearing with a
// misleading accuracy of 0.
export function masteryByNutrient(attempts: ChallengeAttempt[]): NutrientMastery[] {
  const byNutrient = new Map<NutrientKey, { attempted: number; correct: number }>();
  for (const a of attempts) {
    const entry = byNutrient.get(a.nutrient) ?? { attempted: 0, correct: 0 };
    entry.attempted++;
    if (a.correct) entry.correct++;
    byNutrient.set(a.nutrient, entry);
  }
  return Array.from(byNutrient.entries()).map(([nutrient, { attempted, correct }]) => ({
    nutrient,
    attempted,
    correct,
    accuracy: attempted > 0 ? Math.round((correct / attempted) * 100) : null,
  }));
}