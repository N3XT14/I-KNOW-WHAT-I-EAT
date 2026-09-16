// Picks which nutrient the AI tutor should coach on, and caches the
// generated line per profile per day so revisiting Learn Mode doesn't
// burn a Gemini call (and doesn't make the tip flicker/change) unless
// something about the underlying data actually changed.
//
// Generation is triggered by refreshTutorTip below, called right when a
// challenge is answered (the actual event worth coaching on) — not by
// the Learn page being viewed. That means by the time someone navigates
// to Learn Mode, the tip (if anything changed) is already sitting in
// cache: TutorTip.tsx just reads it, instantly, with no fetch and no
// loading flicker on every visit.

import { getChallengeAttemptsForProfile } from "@/lib/challengeAttempts";
import { masteryByNutrient, type NutrientMastery } from "@/lib/streaks";
import { eligibleFoodsForNutrient } from "@/lib/challengePool";
import { nutrientLabel } from "@/lib/nutrientLabels";
import { currentAgeBand, profileLanguage, type Profile } from "@/types/profile";
import type { FoodEvent } from "@/types/foodEvent";
import type { TutorTipApiResponse } from "@/types/tutorTip";

function isBrowser() {
  return typeof window !== "undefined";
}

function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// The weakest attempted nutrient (lowest accuracy; ties broken toward
// more attempts, since that's stronger evidence of a real weak spot
// rather than one unlucky guess) plus the strongest other one, if any,
// for a bit of contrast in the tip. Null when nothing's been attempted
// yet — there's no weak spot to coach on.
export function pickWeakNutrient(
  mastery: NutrientMastery[],
): { weak: NutrientMastery; strong: NutrientMastery | null } | null {
  const attempted = mastery.filter((m) => m.attempted > 0);
  if (attempted.length === 0) return null;

  const weak = [...attempted].sort((a, b) => {
    const accDiff = (a.accuracy ?? 0) - (b.accuracy ?? 0);
    if (accDiff !== 0) return accDiff;
    return b.attempted - a.attempted;
  })[0];

  const strong =
    attempted
      .filter((m) => m.nutrient !== weak.nutrient)
      .sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0))[0] ?? null;

  return { weak, strong };
}

// Changes whenever there's new evidence worth a fresh tip (more
// attempts, a changed accuracy) or a new day — stable otherwise, so
// repeat visits the same day with no new activity reuse the cached line.
// language is folded in too, same reasoning as the Learn content cache:
// switching a profile's language shouldn't serve back a tip generated in
// the other language.
export function tutorTipCacheKey(profileId: string, weak: NutrientMastery, language: string = "en"): string {
  return `${profileId}:${localDateKey()}:${weak.nutrient}:${weak.attempted}:${weak.accuracy}:${language}`;
}

const CACHE_PREFIX = "iky-tutor-tip:";

export function getCachedTip(cacheKey: string): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(CACHE_PREFIX + cacheKey);
  } catch {
    return null;
  }
}

export function setCachedTip(cacheKey: string, tip: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(CACHE_PREFIX + cacheKey, tip);
  } catch {
    // Storage full or unavailable — the tip still rendered this visit,
    // just won't be cached for next time. Not worth failing over.
  }
}

// The event-driven trigger: call this right after saveChallengeAttempt
// succeeds (see the four challenge components), not from the Learn page.
// Recomputes mastery from scratch (cheap — pure localStorage reads) and,
// only if the resulting weak-nutrient state doesn't already have a
// cached tip, fires the Gemini call in the background. Deliberately
// fire-and-forget from the caller's side — a challenge screen shouldn't
// wait on this or show any loading state for it; by the time someone
// reaches Learn Mode, this has already had time to finish.
export async function refreshTutorTip(profile: Profile, events: FoodEvent[]): Promise<void> {
  const attempts = getChallengeAttemptsForProfile(profile.id);
  const mastery = masteryByNutrient(attempts);
  const picked = pickWeakNutrient(mastery);
  if (!picked) return;

  const language = profileLanguage(profile);
  const cacheKey = tutorTipCacheKey(profile.id, picked.weak, language);
  if (getCachedTip(cacheKey)) return; // this exact weak-nutrient state was already coached on

  const eligible = eligibleFoodsForNutrient(events, profile, picked.weak.nutrient);
  const recentFoods = eligible
    .slice(0, 3)
    .map((f) => ({ productName: f.productName, percentOfLimit: f.evaluation.percentOfLimit }));

  try {
    const res = await fetch("/api/tutor-tip", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        profileName: profile.name,
        ageBand: currentAgeBand(profile.dob),
        weakNutrient: nutrientLabel(picked.weak.nutrient, language),
        accuracy: picked.weak.accuracy,
        attempted: picked.weak.attempted,
        strongNutrient: picked.strong
          ? { nutrient: nutrientLabel(picked.strong.nutrient, language), accuracy: picked.strong.accuracy }
          : null,
        recentFoods,
        language,
      }),
    });
    const data = (await res.json()) as TutorTipApiResponse;
    if (data.ok) setCachedTip(cacheKey, data.tip);
  } catch {
    // Best-effort — Learn Mode will simply show the previous cached tip
    // (or nothing, on a first-ever attempt) until a future event succeeds.
  }
}