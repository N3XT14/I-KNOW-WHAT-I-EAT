// Dev-time cache for /api/scan's Gemini call, keyed by a hash of the
// image bytes plus whatever optional context text was sent (since that
// text can change the read) and the requested language (since the
// headline is now generated in that language — without this, re-scanning
// the same test photo after switching a profile's language would silently
// serve back the other language's cached extraction instead of calling
// Gemini again). Re-scanning the exact same test photo while
// iterating on the UI or the prompt shouldn't burn tokens, eat into the
// free-tier rate limit, or risk a transient 503 like:
//   "This model is currently experiencing high demand... UNAVAILABLE"
//
// Not meant for production: real users scan a different photo almost every
// time, so the hit rate there is close to zero — this exists purely to
// make local iteration cheap and resilient. Disabled outside development
// for that reason (see CACHE_ENABLED below).
//
// Filesystem-based rather than in-memory so the cache survives a dev
// server restart (`next dev` restarts often on file changes). If the
// filesystem isn't writable, caching is silently skipped rather than
// breaking the request — see the try/catch in each function.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ScanApiResponse } from "@/types/scanResult";

// Versioned directory name — bumping this whenever the cached response
// shape changes guarantees old cache files are never misread as the new
// shape (they were, once: a stale .cache/scans/*.json from before the
// single-endpoint rewrite briefly got served as-is, bypassing Gemini and
// the ok/item wrapper entirely, since nothing here validated the shape
// coming back off disk). If the shape changes again, bump "v2" -> "v3".
const CACHE_DIR = path.join(process.cwd(), ".cache", "scans-v2");
const CACHE_ENABLED = process.env.NODE_ENV !== "production";

type CachedScan = Extract<ScanApiResponse, { ok: true }>;

function cacheKey(imageBase64: string, mediaType: string, contextText: string | null, language: string): string {
  return createHash("sha256")
    .update(mediaType)
    .update(contextText ?? "")
    .update(language)
    .update(imageBase64)
    .digest("hex");
}

export async function getCachedScan(
  imageBase64: string,
  mediaType: string,
  contextText: string | null,
  language: string,
): Promise<CachedScan | null> {
  if (!CACHE_ENABLED) return null;
  try {
    const file = path.join(CACHE_DIR, `${cacheKey(imageBase64, mediaType, contextText, language)}.json`);
    const raw = await readFile(file, "utf-8");
    const parsed = JSON.parse(raw);
    // Defensive shape check — if a cache file ever doesn't match what this
    // function is supposed to return (e.g. left over from a previous
    // response-shape version despite the directory bump above), treat it
    // as a miss and fall through to a real Gemini call rather than handing
    // malformed data to the client.
    if (parsed?.ok !== true || !parsed?.item) return null;
    return parsed as CachedScan;
  } catch {
    // Miss, or cache dir/file doesn't exist yet — either way, fall through
    // to a real Gemini call. Not an error worth logging.
    return null;
  }
}

export async function setCachedScan(
  imageBase64: string,
  mediaType: string,
  contextText: string | null,
  language: string,
  result: CachedScan,
): Promise<void> {
  if (!CACHE_ENABLED) return;
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const file = path.join(CACHE_DIR, `${cacheKey(imageBase64, mediaType, contextText, language)}.json`);
    await writeFile(file, JSON.stringify(result, null, 2), "utf-8");
  } catch (err) {
    // A read-only filesystem or similar shouldn't fail the actual scan —
    // the user already has their result, caching it is a bonus.
    console.warn("Scan cache write skipped:", err);
  }
}