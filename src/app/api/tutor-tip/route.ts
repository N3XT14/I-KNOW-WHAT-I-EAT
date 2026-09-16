// Generates one short, personalized coaching line — the "personal health
// tutor" voice — from a profile's real mastery data and real logged
// foods. Same Gemini call pattern as /api/scan/route.ts (model, retry,
// schema-constrained JSON), kept as its own route because the input/
// output shape and system prompt are unrelated to label-reading.
//
// Deliberately never asked to reason about anything it wasn't handed:
// every number it's allowed to cite (accuracy, percentOfLimit) comes
// straight from the request body, computed by lib/streaks.ts and
// lib/challengePool.ts from real localStorage data — this route's prompt
// explicitly forbids inventing any figure not given to it, same
// no-fabrication principle as /api/scan's "estimated" path.

import { NextRequest, NextResponse } from "next/server";
import type { TutorTipApiResponse } from "@/types/tutorTip";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3.7-flash";

type TutorTipRequest = {
  profileName: string;
  ageBand: string;
  weakNutrient: string;
  accuracy: number;
  attempted: number;
  strongNutrient: { nutrient: string; accuracy: number } | null;
  recentFoods: { productName: string; percentOfLimit: number }[];
  language?: string;
};

// Same narrow scope as /api/learn-content's version: only the tutor's own
// sentence changes language. Real data handed to it (productName, the
// profile's name) is carried through as given.
const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  en: "",
  hi: " Write the coaching line in Hindi (Devanagari script), plain and warm — the way you'd talk to a parent at home, not textbook Hindi. Keep the profile's name and any product name exactly as given.",
};

const SYSTEM_PROMPT = `You are a warm, encouraging personal nutrition
tutor inside a food-label-literacy app for Indian families. You write ONE
short coaching line (1-2 sentences, under 40 words) for the parent
reading the app, about a specific child/profile's progress on ONE
nutrient they're weaker on in the app's quiz challenges.

YOUR JOB IS TO COACH, NOT TO REPORT. The app already shows a mastery
card with the raw accuracy numbers elsewhere on the same screen — your
line sits right next to it. If your line just restates those numbers in
prose ("X is doing well with sugar, but sodium is trickier" / "X got 6
of 10 right"), you have failed at your job: that's a summary the person
can already see, not tutoring. The accuracy/attempted numbers you're
given are BACKGROUND CONTEXT ONLY, to calibrate your tone (more
encouraging if accuracy is very low, lighter touch if it's already
decent) — never the content of what you say.

Instead, give ONE concrete, memorable, forward-looking piece of
guidance: a specific thing to watch for next time, a technique for
spotting it on a label, or a nudge toward what to try next — grounded in
the real food(s) you're given. Good: "Sat fat hides in things that
don't taste greasy — next time, check the label even on something like
[food] before assuming it's light." Bad: "X is struggling with
saturated fat, getting it right less often than sugar."

CRITICAL — you will be given the only facts you're allowed to use:
- accuracy/attempted counts for the weak nutrient (and optionally a
  strong nutrient, for contrast) — background tone-calibration only, per
  above
- 0-3 real foods this profile actually logged, each with its real
  percentOfLimit for that nutrient

NEVER invent a number, product, or fact not given to you. NEVER state or
imply a percentage, gram amount, or product detail beyond what's in
recentFoods. If recentFoods is empty, write a general, actionable tip
about the weak nutrient without citing any specific food.

Tone: warm, specific, never alarming or shaming — this is a parent
glancing at their phone, not a lab report. Reference the profile by name.
Plain language, no jargon, no emoji.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    tip: { type: "STRING" },
  },
  required: ["tip"],
  propertyOrdering: ["tip"],
};

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  let lastResponse: Response | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(url, init);
    if (response.status !== 503) return response;
    lastResponse = response;
    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  return lastResponse!;
}

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json<TutorTipApiResponse>(
      { ok: false, error: "Server is missing GEMINI_API_KEY." },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as TutorTipRequest | null;
  if (!body?.profileName || !body?.weakNutrient) {
    return NextResponse.json<TutorTipApiResponse>(
      { ok: false, error: "Missing profile or nutrient data." },
      { status: 400 },
    );
  }

  const languageInstruction = LANGUAGE_INSTRUCTIONS[body.language ?? "en"] ?? "";
  const promptText = `Profile: ${body.profileName} (age band ${body.ageBand})
Weak nutrient: ${body.weakNutrient} — ${body.accuracy}% accuracy over ${body.attempted} attempt(s)
${body.strongNutrient ? `Strong nutrient for contrast: ${body.strongNutrient.nutrient} — ${body.strongNutrient.accuracy}% accuracy` : "No strong nutrient to contrast."}
Real logged foods for ${body.weakNutrient}:
${
  body.recentFoods.length > 0
    ? body.recentFoods
        .map((f) => `- ${f.productName}: ${f.percentOfLimit}% of daily limit`)
        .join("\n")
    : "(none logged yet)"
}

Write the one coaching line now.${languageInstruction}`;

  try {
    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            temperature: 0.6,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini tutor-tip error:", response.status, errText);
      const message =
        response.status === 503
          ? "Gemini is under high demand right now — please try again in a moment."
          : "Couldn't generate a tip right now.";
      return NextResponse.json<TutorTipApiResponse>({ ok: false, error: message }, { status: 502 });
    }

    const data = await response.json();
    const rawText: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      console.error("No text in Gemini tutor-tip response:", JSON.stringify(data));
      return NextResponse.json<TutorTipApiResponse>(
        { ok: false, error: "No tip returned." },
        { status: 502 },
      );
    }

    const parsed = JSON.parse(rawText) as { tip: string };
    return NextResponse.json<TutorTipApiResponse>({ ok: true, tip: parsed.tip });
  } catch (err) {
    console.error("Tutor-tip route error:", err);
    return NextResponse.json<TutorTipApiResponse>(
      { ok: false, error: "Something went wrong generating a tip." },
      { status: 500 },
    );
  }
}