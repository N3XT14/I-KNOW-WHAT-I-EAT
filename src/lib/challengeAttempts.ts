// localStorage-backed challenge attempt log. Append-only — attempts are
// never edited or removed once logged, since they're a historical record
// ("what did this profile actually try, and when") rather than current
// state. Same key-naming and isBrowser/try-catch convention as
// lib/foodEvents.ts and lib/profiles.ts.
//
//   iky-challenge-attempts -> ChallengeAttempt[]

import type { ChallengeAttempt } from "@/types/challengeAttempt";

const CHALLENGE_ATTEMPTS_KEY = "iky-challenge-attempts";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getChallengeAttempts(): ChallengeAttempt[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(CHALLENGE_ATTEMPTS_KEY);
    return raw ? (JSON.parse(raw) as ChallengeAttempt[]) : [];
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