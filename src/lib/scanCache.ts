// Dev-time cache for /api/scan's Gemini call, keyed by a hash of the image
// bytes. Re-scanning the exact same test photo while iterating on the UI
// or the prompt shouldn't burn tokens, eat into the free-tier rate limit,
// or risk a transient 503 like:
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
import type { LabelExtraction } from "@/types/labelExtraction";

const CACHE_DIR = path.join(process.cwd(), ".cache", "scans");
const CACHE_ENABLED = process.env.NODE_ENV !== "production";

function cacheKey(imageBase64: string, mediaType: string): string {
  return createHash("sha256").update(mediaType).update(imageBase64).digest("hex");
}

export async function getCachedExtraction(
  imageBase64: string,
  mediaType: string,
): Promise<LabelExtraction | null> {
  if (!CACHE_ENABLED) return null;
  try {
    const file = path.join(CACHE_DIR, `${cacheKey(imageBase64, mediaType)}.json`);
    const raw = await readFile(file, "utf-8");
    return JSON.parse(raw) as LabelExtraction;
  } catch {
    // Miss, or cache dir/file doesn't exist yet — either way, fall through
    // to a real Gemini call. Not an error worth logging.
    return null;
  }
}

export async function setCachedExtraction(
  imageBase64: string,
  mediaType: string,
  extraction: LabelExtraction,
): Promise<void> {
  if (!CACHE_ENABLED) return;
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    const file = path.join(CACHE_DIR, `${cacheKey(imageBase64, mediaType)}.json`);
    await writeFile(file, JSON.stringify(extraction, null, 2), "utf-8");
  } catch (err) {
    // A read-only filesystem or similar shouldn't fail the actual scan —
    // the user already has their result, caching it is a bonus.
    console.warn("Scan cache write skipped:", err);
  }
}