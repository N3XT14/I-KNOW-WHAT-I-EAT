// Remembers the last item-set shown for a given lesson+profile+kind, so
// Rank and Odd-one-out can avoid immediately repeating the exact same
// trio when the eligible pool is large enough to offer a different one.
// This is purely a "what did we just show" cache for variety, not attempt
// history — see lib/challengeAttempts.ts for the actual answer log.

function isBrowser() {
  return typeof window !== "undefined";
}

function key(lessonId: string, profileId: string, kind: string): string {
  return `iky-last-shown:${lessonId}:${profileId}:${kind}`;
}

export function getLastShownIds(
  lessonId: string,
  profileId: string,
  kind: string,
): string[] | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(key(lessonId, profileId, kind));
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

export function setLastShownIds(
  lessonId: string,
  profileId: string,
  kind: string,
  itemIds: string[],
): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key(lessonId, profileId, kind), JSON.stringify(itemIds));
  } catch {
    // Best-effort — worst case, variety doesn't improve this visit.
  }
}