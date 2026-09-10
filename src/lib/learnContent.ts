// Same shape as lib/tutorTip.ts: cache the generated sequence per
// profile+lesson+day so revisiting a lesson doesn't re-burn a Gemini
// call, and fall back to the zero-AI deterministic sequence (never an
// error screen) whenever generation fails.

import type { FoodEvent } from "@/types/foodEvent";
import type { Profile } from "@/types/profile";
import type { NutrientKey } from "@/types/nutrientLimits";
import type { LearnContentSequence } from "@/types/learnContent";
import { buildFactsPacket } from "@/lib/learnContentPool";
import { buildFallbackSequence } from "@/lib/learnContentFallback";

function isBrowser() {
  return typeof window !== "undefined";
}

function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Includes the scan-food count so logging a new eligible food invalidates
// the cache same-day and the next visit gets fresh content grounded in
// the new data, rather than being stuck on yesterday's set until midnight.
// Bump this whenever the block schema or route validation logic changes
// server-side — otherwise a client that cached a result under the old
// rules keeps serving it forever, never re-hitting the API to pick up
// the fix.
const CONTENT_VERSION = "v3";

function cacheKey(profileId: string, lessonId: string, scanFoodCount: number): string {
  return `iky-learn-content:${CONTENT_VERSION}:${profileId}:${lessonId}:${localDateKey()}:${scanFoodCount}`;
}

function getCached(key: string): LearnContentSequence | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as LearnContentSequence) : null;
  } catch {
    return null;
  }
}

function setCached(key: string, sequence: LearnContentSequence): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(sequence));
  } catch {
    // Best-effort — this visit already has the sequence, just won't be cached.
  }
}

export async function getLearnContent(
  profile: Profile,
  events: FoodEvent[],
  lessonId: string,
  nutrient: NutrientKey,
): Promise<LearnContentSequence> {
  const facts = buildFactsPacket(profile, events, nutrient);
  const key = cacheKey(profile.id, lessonId, facts.scanFoods.length);

  const cached = getCached(key);
  if (cached) return cached;

  try {
    const res = await fetch("/api/learn-content", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lessonId, facts }),
    });
    const data = await res.json();
    if (data.ok) {
      setCached(key, data.sequence as LearnContentSequence);
      return data.sequence as LearnContentSequence;
    }
  } catch {
    // fall through to the deterministic sequence below
  }

  const fallback = buildFallbackSequence(lessonId, facts);
  setCached(key, fallback);
  return fallback;
}