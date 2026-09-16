// Learn tab card generation. Used to be a static 3-lesson array (one
// "basics" card per nutrient); now each nutrient can produce multiple
// cards ("angles"), and which angles actually appear depends on whether
// the profile's real scan/consumption data supports them — so the outer
// card list is personalized the same way the AI-generated content inside
// each card already is, rather than the card shell being a fixed label
// the personalization happens behind.
//
// "basics" is the only angle guaranteed to exist (it works with zero
// scan history, same copy as the original v1 lessons). The others only
// show up once there's real data to ground them in:
//   - "claims"         -> the profile has logged >=1 product with a
//                          claim on its label for this nutrient
//   - "compare"        -> the profile has >=2 eligible logged foods for
//                          this nutrient (nothing to compare with just 1)
//   - "hidden-sources"  -> the profile has >=1 eligible logged food for
//                          this nutrient AND there's a reference product
//                          (not logged by them) to contrast it against —
//                          both sides need to be real for the comparison
//                          to mean anything

import { isSourced } from "@/types/foodItem";
import type { FoodEvent } from "@/types/foodEvent";
import type { Profile } from "@/types/profile";
import { TRACKED_NUTRIENT_KEYS, type NutrientKey } from "@/types/nutrientLimits";
import type { Lesson, LessonAngle } from "@/types/learnMode";
import { eligibleFoodsForNutrient, decoyCandidates, type EligibleFood } from "@/lib/challengePool";
import { nutrientLabel } from "@/lib/nutrientLabels";
import { getCompletedLessonIds } from "@/lib/lessonCompletions";
import { pickWeakNutrient } from "@/lib/tutorTip";
import type { NutrientMastery } from "@/lib/streaks";

const LESSON_ANGLES: LessonAngle[] = ["basics", "claims", "compare", "hidden-sources"];

// Short, url/id-safe stand-in for "saturatedFat" — kept exactly as the
// original static ids used it ("satfat-basics") so existing
// ChallengeAttempt/LessonCompletion rows logged under those ids keep
// resolving to the same lesson after this change.
const NUTRIENT_SLUG: Record<NutrientKey, string> = {
  sugar: "sugar",
  sodium: "sodium",
  saturatedFat: "satfat",
};
const SLUG_TO_NUTRIENT: Record<string, NutrientKey> = {
  sugar: "sugar",
  sodium: "sodium",
  satfat: "saturatedFat",
};

function lessonId(nutrient: NutrientKey, angle: LessonAngle): string {
  return `${NUTRIENT_SLUG[nutrient]}-${angle}`;
}

// Original v1 copy, unchanged — this is the only angle that has to work
// with zero scan history, so it stays generic/educational rather than
// data-referencing.
const BASICS_COPY: Record<NutrientKey, { title: string; body: string }> = {
  sugar: {
    title: "Why sugar limits matter",
    body: "Added sugar shows up in foods that don't taste \"sweet\" — sauces, breads, even some namkeen. Your body doesn't need much of it, and eating past the daily limit regularly is linked to weight gain and tooth decay. Checking a label's sugar line before eating is the single fastest habit for catching it.",
  },
  sodium: {
    title: "Salt hides in unexpected places",
    body: "Sodium isn't just table salt — it's in packaged snacks, pickles, and instant foods, often at levels that use up most of a day's limit in one serving. Some labels print \"Salt\" instead of \"Sodium\"; they're related but not the same number, so it's worth knowing which one you're reading.",
  },
  saturatedFat: {
    title: "Not all fat is the same",
    body: "Saturated fat is the kind labels call out separately from \"Total Fat\" because eating too much of it regularly is linked to heart health issues later in life. It's common in fried snacks and bakery items — checking the saturated fat line separately from total fat catches foods that look fine at a glance but aren't.",
  },
};

function angleCopy(nutrient: NutrientKey, angle: LessonAngle): { title: string; body: string } {
  const label = nutrientLabel(nutrient);
  if (angle === "basics") return BASICS_COPY[nutrient];
  if (angle === "claims") {
    return {
      title: `Claims worth double-checking: ${label}`,
      body: `Some of what you've scanned makes a claim about ${label} right on the front of the pack. This lesson walks through whether those claims hold up against the label's own numbers.`,
    };
  }
  if (angle === "compare") {
    return {
      title: `Compare what you've scanned: ${label}`,
      body: `You've logged more than one food with ${label} in it — this lesson puts them side by side so it's easier to see which ones are actually using up more of the daily limit.`,
    };
  }
  return {
    title: `Where ${label} sneaks in`,
    body: `This lesson contrasts what you've actually eaten against other everyday foods, to build a feel for where ${label} shows up in places that aren't obvious.`,
  };
}

// Pure, no eligibility check — works from the id alone, so a direct visit
// to a lesson page (bookmark, refresh, browser back) still resolves
// correctly even if that card would no longer appear in today's
// generated list (e.g. it's since been completed and filtered out).
export function getLesson(id: string): Lesson | undefined {
  for (const [slug, nutrient] of Object.entries(SLUG_TO_NUTRIENT)) {
    const prefix = `${slug}-`;
    if (!id.startsWith(prefix)) continue;
    const angle = id.slice(prefix.length) as LessonAngle;
    if (!LESSON_ANGLES.includes(angle)) continue;
    const copy = angleCopy(nutrient, angle);
    return { id, ageBand: "all", nutrientFocus: nutrient, angle, ...copy };
  }
  return undefined;
}

function hasLoggedClaims(eligible: EligibleFood[]): boolean {
  return eligible.some((f) => isSourced(f.event.item) && f.event.item.extraction.claims.length > 0);
}

// The Learn tab's actual card list for a profile: every (nutrient,
// angle) combination their real data currently supports, minus any
// they've already completed (see lib/lessonCompletions.ts —
// cooldownDays is a future hook to let a card resurface after N days
// instead of staying hidden forever; unset means "hidden for good," same
// as today's behavior).
export function getLessonCards(profile: Profile, events: FoodEvent[], cooldownDays?: number): Lesson[] {
  const completed = getCompletedLessonIds(profile.id, cooldownDays);
  const cards: Lesson[] = [];

  for (const nutrient of TRACKED_NUTRIENT_KEYS) {
    const eligible = eligibleFoodsForNutrient(events, profile, nutrient);
    const angles: LessonAngle[] = ["basics"];
    if (hasLoggedClaims(eligible)) angles.push("claims");
    if (eligible.length >= 2) angles.push("compare");
    if (eligible.length > 0 && decoyCandidates(eligible, nutrient).length > 0) angles.push("hidden-sources");

    for (const angle of angles) {
      const id = lessonId(nutrient, angle);
      if (completed.has(id)) continue;
      cards.push({ id, ageBand: "all", nutrientFocus: nutrient, angle, ...angleCopy(nutrient, angle) });
    }
  }

  return cards;
}

// Picks the one lesson "Today's Class" should open directly into — the
// weakest-mastery nutrient's earliest available angle (basics first,
// since getLessonCards already emits angles in that order per nutrient),
// falling back through the remaining tracked nutrients in their normal
// order if the weakest one has no eligible card left (e.g. already
// completed today). Reuses the exact same weak-nutrient logic as the
// tutor tip nudge, so "today's class" and "what the tutor is nudging
// about" are always pointing at the same thing, not two different
// opinions about what needs work.
//
// Returns null only when there's truly nothing left to teach (every
// eligible card, for every nutrient, already completed) — the caller
// should hide the "Today's Class" entry point in that case.
export function pickTodaysClass(mastery: NutrientMastery[], cards: Lesson[]): Lesson | null {
  if (cards.length === 0) return null;
  const weak = pickWeakNutrient(mastery)?.weak.nutrient;
  const priority = weak ? [weak, ...TRACKED_NUTRIENT_KEYS.filter((n) => n !== weak)] : TRACKED_NUTRIENT_KEYS;
  for (const nutrient of priority) {
    const match = cards.find((c) => c.nutrientFocus === nutrient);
    if (match) return match;
  }
  return null;
}