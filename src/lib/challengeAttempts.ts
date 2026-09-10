// localStorage-backed challenge attempt log. Append-only — attempts are
// never edited or removed once logged, since they're a historical record
// ("what did this profile actually try, and when") rather than current
// state. Same key-naming and isBrowser/try-catch convention as
// lib/foodEvents.ts and lib/profiles.ts.
//
//   iky-challenge-attempts -> ChallengeAttempt[]

import type { BucketGuessAttempt, ChallengeAttempt } from "@/types/challengeAttempt";

const CHALLENGE_ATTEMPTS_KEY = "iky-challenge-attempts";

function isBrowser() {
  return typeof window !== "undefined";
}

// Attempts saved before challenge kinds existed (the union in
// types/challengeAttempt.ts) don't have a `kind` field on disk — they're
// always the original bucket-guess format, since that was the only kind
// that existed then. Migrating on read (rather than a one-time rewrite)
// keeps this simple and never risks a lossy migration bug corrupting
// someone's history.
type LegacyBucketGuessAttempt = Omit<BucketGuessAttempt, "kind">;

function migrate(a: ChallengeAttempt | LegacyBucketGuessAttempt): ChallengeAttempt {
  if ("kind" in a) return a;
  return { ...a, kind: "bucket-guess" };
}

export function getChallengeAttempts(): ChallengeAttempt[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(CHALLENGE_ATTEMPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as (ChallengeAttempt | LegacyBucketGuessAttempt)[];
    return parsed.map(migrate);
  } catch {
    return [];
  }
}

export function saveChallengeAttempt(attempt: ChallengeAttempt): void {
  if (!isBrowser()) return;
  const attempts = getChallengeAttempts();
  attempts.push(attempt);
  window.localStorage.setItem(CHALLENGE_ATTEMPTS_KEY, JSON.stringify(attempts));
}

export function getChallengeAttemptsForProfile(profileId: string): ChallengeAttempt[] {
  return getChallengeAttempts().filter((a) => a.profileId === profileId);
}

// The set of foodEventIds a given attempt was actually about — varies by
// kind since each format captures different fields (see
// types/challengeAttempt.ts). Used only for the prior-attempt match
// below, so it's kept private to this file.
function itemIdsForAttempt(a: ChallengeAttempt): string[] {
  switch (a.kind) {
    case "bucket-guess":
      return [a.foodEventId];
    case "recall-decoy":
      return [a.realFoodEventId];
    case "rank":
    case "odd-one-out":
      return a.foodEventIds;
    case "generated":
      return [a.blockId];
  }
}

// Whether this profile has already attempted a challenge of this exact
// kind, over this exact set of foods (order doesn't matter), for this
// lesson. Lets a challenge component show "you've tried this one before"
// instead of leaving someone unsure whether what they're looking at is
// new — a small eligible pool can otherwise resurface the same trio by
// chance with no way to tell.
export function findPriorAttempt(
  profileId: string,
  lessonId: string,
  kind: ChallengeAttempt["kind"],
  itemIds: string[],
): ChallengeAttempt | null {
  const target = new Set(itemIds);
  const attempts = getChallengeAttemptsForProfile(profileId).filter(
    (a) => a.lessonId === lessonId && a.kind === kind,
  );
  return (
    attempts.find((a) => {
      const ids = itemIdsForAttempt(a);
      return ids.length === target.size && ids.every((id) => target.has(id));
    }) ?? null
  );
}