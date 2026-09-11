// localStorage-backed log of finished lesson cards, per profile. A card
// that's been completed drops out of the Learn tab's generated list (see
// lib/lessons.ts) so the same card isn't resurfaced forever — same
// key-naming and isBrowser/try-catch convention as
// lib/challengeAttempts.ts and lib/foodEvents.ts.
//
//   iky-lesson-completions -> LessonCompletion[]

const LESSON_COMPLETIONS_KEY = "iky-lesson-completions";

export type LessonCompletion = {
  profileId: string;
  lessonId: string;
  completedAt: string;
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function getLessonCompletions(): LessonCompletion[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(LESSON_COMPLETIONS_KEY);
    return raw ? (JSON.parse(raw) as LessonCompletion[]) : [];
  } catch {
    return [];
  }
}

// Idempotent — re-finishing an already-completed card (e.g. revisiting a
// cached sequence) doesn't add a second row or bump completedAt, since
// "when was this first finished" is the more useful timestamp for a
// future cooldown feature than "when was it last seen."
export function markLessonCompleted(profileId: string, lessonId: string): void {
  if (!isBrowser()) return;
  const completions = getLessonCompletions();
  if (completions.some((c) => c.profileId === profileId && c.lessonId === lessonId)) return;
  completions.push({ profileId, lessonId, completedAt: new Date().toISOString() });
  window.localStorage.setItem(LESSON_COMPLETIONS_KEY, JSON.stringify(completions));
}

// cooldownDays is a future hook: pass a number to let a completed card
// resurface after that many days (spaced-repetition-style reuse) instead
// of staying hidden forever. Unset (the default) is today's behavior —
// once completed, a card never comes back.
export function isLessonCompleted(
  profileId: string,
  lessonId: string,
  cooldownDays?: number,
): boolean {
  const entry = getLessonCompletions().find(
    (c) => c.profileId === profileId && c.lessonId === lessonId,
  );
  if (!entry) return false;
  if (cooldownDays === undefined) return true;
  const ageMs = Date.now() - new Date(entry.completedAt).getTime();
  return ageMs < cooldownDays * 24 * 60 * 60 * 1000;
}

export function getCompletedLessonIds(profileId: string, cooldownDays?: number): Set<string> {
  return new Set(
    getLessonCompletions()
      .filter((c) => c.profileId === profileId)
      .filter((c) => isLessonCompleted(profileId, c.lessonId, cooldownDays))
      .map((c) => c.lessonId),
  );
}
