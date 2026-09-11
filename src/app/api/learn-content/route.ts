import { NextRequest, NextResponse } from "next/server";
import type { LearnFactsPacket } from "@/lib/learnContentPool";
import type { LearnContentBlock, LearnContentSequence } from "@/types/learnContent";
import { isChallengeBlock } from "@/types/learnContent";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3.7-flash";

// Steers which challenge kinds to reach for so a card's generated
// content actually matches what its title/teaser on the Learn tab
// promised, instead of every card for a nutrient producing the same
// generic mix. Appended to the per-request prompt (not baked into
// SYSTEM_PROMPT) since it varies per call; the format/validation rules
// in SYSTEM_PROMPT stay the same regardless of angle.
const ANGLE_INSTRUCTIONS: Record<string, string> = {
  basics:
    "Angle: basics. Use the usual mixed set of challenge kinds appropriate to the facts packet — no particular kind is favored.",
  claims:
    'Angle: claims. This card is specifically about double-checking label claims. If the packet\'s "claims" array has at least one entry, at least one challenge block MUST be a "spot-the-trick" block built from a real claim in that array. Only add a second block (a different kind) if the packet meaningfully supports one — never pad with an unrelated kind just to hit 2.',
  compare:
    'Angle: compare. This card is specifically about comparing foods the profile has actually scanned. Prioritize a "comparison" block (2 items) or "ranked-list" block (3+ items) built from real "scanFoods" entries in the packet. Only use another kind if the packet cannot support a comparison/ranking.',
  "hidden-sources":
    'Angle: hidden-sources. This card is specifically about contrasting what the profile has actually eaten against a food they have NOT logged. Prioritize a "decoy" block: real = one entry from "scanFoods", decoy = one entry from "decoyFoods". Only use another kind if the packet cannot support that.',
};

const SYSTEM_PROMPT = `You write short Learn Mode content for a food-label
literacy app aimed at parents and kids in India. You will be given a
JSON "facts" packet — real logged foods, real nutrient limits, real
label claims, real glossary terms. You must ONLY use the numbers, names,
and claims already present in that packet. Never invent a gram amount, a
percentage, a food name, or a claim that isn't in the packet — if the
packet doesn't have enough for a block type, skip that block type.

Produce a sequence of 2-3 blocks. This is a hard requirement: the
sequence MUST contain exactly one "story" block AND at least one
challenge block — a story-only response is a failure. Start with the
"story" block (a short, warm 2-4 sentence hook about the nutrient,
optionally with a playful mascotLine), then challenge blocks of
DIFFERENT kinds drawn from whatever the facts packet supports.
Produce exactly 2 challenge blocks whenever the packet supports it.
Only produce 1 challenge block if the packet is thin — little or no
scan history (hasScanHistory false or fewer than 2 usable scanFoods)
and few claims or glossary terms to draw a second, genuinely different
challenge from. Never pad to 2 by repeating a kind or inventing
content just to hit the count. If hasScanHistory is true, prefer
scan-grounded kinds (quiz-mc/comparison/bar-vs-limit/ranked-list/decoy/
spot-the-trick, each using real scanFoods/decoyFoods/claims and their
real foodEventId). Comparison blocks must always ask "which has MORE"
of the nutrient — never "which has less" or "which is lower" — since
the correct answer is always the higher-value item. If hasScanHistory is false, use only reference-
grounded content: quiz-mc or matching built from the glossary, or
bar-vs-limit/spot-the-trick with source.kind "reference" and no
foodEventId.

A reference-grounded quiz-mc block is NOT a bar-vs-limit block. It
still MUST include a non-empty "options" array (3-4 plausible choices,
one clearly correct), a "correctOptionId" matching one of those
options, and an "explanation" — leave "value"/"unit"/"limitAmount"
null for it. Example shape for a reference quiz-mc: prompt "What does
'Total Sugars' mean on a label?", options like the correct glossary
definition plus 2-3 plausible-but-wrong definitions, correctOptionId
pointing at the right one. A matching block MUST include a non-empty
"pairs" array (term + meaning) drawn only from the glossary terms
given. Never emit a quiz-mc or matching block without these fields —
skip the block entirely instead of emitting it half-filled.

For any block whose source is a real food, set sourceFoodEventId to that
food's foodEventId exactly as given in the packet — never a made-up id.
For reference-grounded blocks, leave sourceFoodEventId empty and set
sourceKind to "reference".

Assign "difficulty" 1-3 across the challenge blocks, roughly increasing.
Keep every prompt/explanation warm, plain, non-alarming, short (1-2
sentences). mascotLine is an optional playful one-liner from the app's
food-detective mascot character — upbeat, never mocking.`;

// Discriminated per-kind schemas via anyOf, sent through responseJsonSchema
// (real JSON Schema, lowercase types) rather than the older uppercase
// responseSchema. The old single flat object with every field
// `nullable: true` let the model satisfy the schema by emitting almost
// nothing for a block (only "kind" was ever required) — most visible on
// reference-grounded quiz-mc/matching/spot-the-trick, which came back
// with prompt/options/pairs/etc all null. Each variant below has its own
// non-optional fields, so the schema itself forces them to be present.
const SOURCE_KIND = { type: "string", enum: ["scan", "reference"] };
const SOURCE_FOOD_EVENT_ID = { type: "string" };

const STORY_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["story"] },
    difficulty: { type: "number" },
    text: { type: "string", description: "story block body" },
    mascotLine: { type: "string" },
  },
  required: ["kind", "text"],
};

const QUIZ_MC_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["quiz-mc"] },
    difficulty: { type: "number" },
    prompt: { type: "string" },
    options: {
      type: "array",
      minItems: 3,
      items: {
        type: "object",
        properties: { id: { type: "string" }, label: { type: "string" } },
        required: ["id", "label"],
      },
    },
    correctOptionId: { type: "string" },
    explanation: { type: "string" },
    sourceKind: SOURCE_KIND,
    sourceFoodEventId: SOURCE_FOOD_EVENT_ID,
  },
  required: ["kind", "prompt", "options", "correctOptionId", "explanation", "sourceKind"],
};

const COMPARISON_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["comparison"] },
    difficulty: { type: "number" },
    prompt: { type: "string" },
    items: {
      type: "array",
      minItems: 2,
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          value: { type: "number" },
          unit: { type: "string", enum: ["g", "mg"] },
          foodEventId: { type: "string" },
        },
        required: ["label", "value", "unit"],
      },
    },
    explanation: { type: "string" },
    sourceKind: SOURCE_KIND,
    sourceFoodEventId: SOURCE_FOOD_EVENT_ID,
  },
  required: ["kind", "prompt", "items", "explanation", "sourceKind"],
};

const BAR_VS_LIMIT_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["bar-vs-limit"] },
    difficulty: { type: "number" },
    prompt: { type: "string" },
    label: { type: "string", description: "bar-vs-limit label" },
    value: { type: "number" },
    limitAmount: { type: "number" },
    unit: { type: "string", enum: ["g", "mg"] },
    explanation: { type: "string" },
    sourceKind: SOURCE_KIND,
    sourceFoodEventId: SOURCE_FOOD_EVENT_ID,
  },
  required: ["kind", "prompt", "label", "value", "limitAmount", "unit", "explanation", "sourceKind"],
};

const RANKED_LIST_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["ranked-list"] },
    difficulty: { type: "number" },
    prompt: { type: "string" },
    items: {
      type: "array",
      minItems: 2,
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          foodEventId: { type: "string" },
          value: { type: "number" },
        },
        required: ["label", "foodEventId", "value"],
      },
    },
    explanation: { type: "string" },
    sourceKind: SOURCE_KIND,
    sourceFoodEventId: SOURCE_FOOD_EVENT_ID,
  },
  required: ["kind", "prompt", "items", "explanation", "sourceKind"],
};

const DECOY_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["decoy"] },
    difficulty: { type: "number" },
    prompt: { type: "string" },
    realLabel: { type: "string" },
    realFoodEventId: { type: "string" },
    decoyLabel: { type: "string" },
    decoyValue: { type: "number" },
    decoyUnit: { type: "string", enum: ["g", "mg"] },
    explanation: { type: "string" },
    sourceKind: SOURCE_KIND,
    sourceFoodEventId: SOURCE_FOOD_EVENT_ID,
  },
  required: ["kind", "prompt", "realLabel", "realFoodEventId", "decoyLabel", "decoyValue", "decoyUnit", "explanation", "sourceKind"],
};

const SPOT_THE_TRICK_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["spot-the-trick"] },
    difficulty: { type: "number" },
    prompt: { type: "string" },
    claimText: { type: "string" },
    isMisleading: { type: "boolean" },
    explanation: { type: "string" },
    sourceKind: SOURCE_KIND,
    sourceFoodEventId: SOURCE_FOOD_EVENT_ID,
  },
  required: ["kind", "prompt", "claimText", "isMisleading", "explanation", "sourceKind"],
};

const MATCHING_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["matching"] },
    difficulty: { type: "number" },
    prompt: { type: "string" },
    pairs: {
      type: "array",
      minItems: 2,
      items: {
        type: "object",
        properties: { term: { type: "string" }, meaning: { type: "string" } },
        required: ["term", "meaning"],
      },
    },
    sourceKind: SOURCE_KIND,
    sourceFoodEventId: SOURCE_FOOD_EVENT_ID,
  },
  required: ["kind", "prompt", "pairs", "sourceKind"],
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    blocks: {
      type: "array",
      minItems: 2,
      items: {
        anyOf: [
          STORY_SCHEMA,
          QUIZ_MC_SCHEMA,
          COMPARISON_SCHEMA,
          BAR_VS_LIMIT_SCHEMA,
          RANKED_LIST_SCHEMA,
          DECOY_SCHEMA,
          SPOT_THE_TRICK_SCHEMA,
          MATCHING_SCHEMA,
        ],
      },
    },
  },
  required: ["blocks"],
};

type RawBlock = {
  kind: string;
  difficulty?: number | null;
  text?: string | null;
  mascotLine?: string | null;
  prompt?: string | null;
  explanation?: string | null;
  sourceKind?: "scan" | "reference" | null;
  sourceFoodEventId?: string | null;
  options?: { id: string; label: string }[] | null;
  correctOptionId?: string | null;
  items?: { label: string; value: number; unit: "g" | "mg"; foodEventId?: string | null }[] | null;
  correctLabel?: string | null;
  label?: string | null;
  value?: number | null;
  limitAmount?: number | null;
  unit?: "g" | "mg" | null;
  realLabel?: string | null;
  realFoodEventId?: string | null;
  decoyLabel?: string | null;
  decoyValue?: number | null;
  decoyUnit?: "g" | "mg" | null;
  claimText?: string | null;
  isMisleading?: boolean | null;
  pairs?: { term: string; meaning: string }[] | null;
};

async function fetchWithRetry(url: string, init: RequestInit, maxAttempts = 3): Promise<Response> {
  let lastResponse: Response | undefined;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(url, init);
    if (response.status !== 503) return response;
    lastResponse = response;
    if (attempt < maxAttempts - 1) await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  return lastResponse!;
}

function source(raw: RawBlock, knownIds: Set<string>): { kind: "scan"; foodEventId: string } | { kind: "reference" } | null {
  const id = raw.sourceFoodEventId?.trim();
  if (id) return knownIds.has(id) ? { kind: "scan", foodEventId: id } : null;
  return { kind: "reference" };
}

// Rejects (rather than repairs) any block that's missing required fields
// for its kind or cites a foodEventId not present in the facts packet —
// a malformed/hallucinated block is dropped, not guessed at. Logs why,
// since a silent drop here is exactly what left lessons with no
// challenge blocks and no clue as to why.
function toTypedBlock(raw: RawBlock, index: number, knownIds: Set<string>): LearnContentBlock | null {
  const id = `block-${index}`;
  const diff = raw.difficulty && raw.difficulty >= 1 && raw.difficulty <= 3 ? (Math.round(raw.difficulty) as 1 | 2 | 3) : undefined;
  const reject = (reason: string) => {
    console.warn(`learn-content: rejected block #${index} (kind=${raw.kind}): ${reason}`, raw);
    return null;
  };

  if (raw.kind === "story") {
    return raw.text ? { kind: "story", id, text: raw.text, mascotLine: raw.mascotLine ?? undefined } : reject("missing text");
  }

  const src = source(raw, knownIds);
  if (!src) return reject(`sourceFoodEventId "${raw.sourceFoodEventId}" not in facts packet`);

  if (raw.kind === "quiz-mc") {
    if (!raw.prompt || !raw.options?.length || !raw.correctOptionId || !raw.explanation) return reject("missing required field");
    if (!raw.options.some((o) => o.id === raw.correctOptionId)) return reject("correctOptionId not among options");
    return { kind: "quiz-mc", id, difficulty: diff, prompt: raw.prompt, options: raw.options, correctOptionId: raw.correctOptionId, explanation: raw.explanation, source: src };
  }

  if (raw.kind === "comparison") {
    if (!raw.prompt || !raw.items?.length || !raw.explanation) return reject("missing required field");
    for (const item of raw.items) if (item.foodEventId && !knownIds.has(item.foodEventId)) return reject(`item foodEventId "${item.foodEventId}" not in facts packet`);
    // correctLabel is derived from the real values, not trusted from
    // Gemini's output — it kept omitting or mislabeling this field, and
    // the answer is fully determined by data we already verified anyway.
    const correctLabel = raw.items.reduce((a, b) => (b.value > a.value ? b : a)).label;
    return {
      kind: "comparison",
      id,
      difficulty: diff,
      prompt: raw.prompt,
      items: raw.items.map((i) => ({ label: i.label, value: i.value, unit: i.unit, foodEventId: i.foodEventId ?? undefined })),
      correctLabel,
      explanation: raw.explanation,
      source: src,
    };
  }

  if (raw.kind === "bar-vs-limit") {
    if (!raw.prompt || !raw.label || raw.value == null || raw.limitAmount == null || !raw.unit || !raw.explanation) return reject("missing required field");
    return { kind: "bar-vs-limit", id, difficulty: diff, prompt: raw.prompt, label: raw.label, value: raw.value, limit: raw.limitAmount, unit: raw.unit, explanation: raw.explanation, source: src };
  }

  if (raw.kind === "ranked-list") {
    if (!raw.prompt || !raw.items?.length || !raw.explanation) return reject("missing required field");
    const withIds = raw.items.filter((i) => i.foodEventId);
    if (withIds.length !== raw.items.length) return reject("not every item has a foodEventId");
    for (const item of raw.items) if (item.foodEventId && !knownIds.has(item.foodEventId)) return reject(`item foodEventId "${item.foodEventId}" not in facts packet`);
    return {
      kind: "ranked-list",
      id,
      difficulty: diff,
      prompt: raw.prompt,
      items: raw.items.map((i) => ({ label: i.label, foodEventId: i.foodEventId as string, value: i.value })),
      explanation: raw.explanation,
      source: src,
    };
  }

  if (raw.kind === "decoy") {
    if (!raw.prompt || !raw.realLabel || !raw.realFoodEventId || !raw.decoyLabel || raw.decoyValue == null || !raw.decoyUnit || !raw.explanation) return reject("missing required field");
    if (!knownIds.has(raw.realFoodEventId)) return reject(`realFoodEventId "${raw.realFoodEventId}" not in facts packet`);
    return {
      kind: "decoy",
      id,
      difficulty: diff,
      prompt: raw.prompt,
      real: { label: raw.realLabel, foodEventId: raw.realFoodEventId },
      decoy: { label: raw.decoyLabel, value: raw.decoyValue, unit: raw.decoyUnit },
      explanation: raw.explanation,
      source: src,
    };
  }

  if (raw.kind === "spot-the-trick") {
    if (!raw.prompt || !raw.claimText || raw.isMisleading == null || !raw.explanation) return reject("missing required field");
    return { kind: "spot-the-trick", id, difficulty: diff, prompt: raw.prompt, claimText: raw.claimText, isMisleading: raw.isMisleading, explanation: raw.explanation, source: src };
  }

  if (raw.kind === "matching") {
    return raw.prompt && raw.pairs?.length
      ? { kind: "matching", id, difficulty: diff, prompt: raw.prompt, pairs: raw.pairs, source: src }
      : reject("missing required field");
  }

  return reject("unknown kind");
}

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ ok: false, error: "Server is missing GEMINI_API_KEY." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const lessonId: string | undefined = body?.lessonId;
  const facts: LearnFactsPacket | undefined = body?.facts;
  const angle: string = body?.angle ?? "basics";
  if (!lessonId || !facts) {
    return NextResponse.json({ ok: false, error: "Missing lessonId or facts." }, { status: 400 });
  }

  const knownIds = new Set(facts.scanFoods.map((f) => f.foodEventId));
  const angleInstruction = ANGLE_INSTRUCTIONS[angle] ?? ANGLE_INSTRUCTIONS.basics;

  try {
    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: `Facts packet:\n${JSON.stringify(facts)}\n\n${angleInstruction}` }] }],
          // responseJsonSchema (not responseSchema) — the older field is
          // OpenAPI-flavored and rejects anyOf outright; responseJsonSchema
          // is real JSON Schema and is what lets the per-kind required
          // fields above actually get enforced.
          generationConfig: { temperature: 0.6, responseMimeType: "application/json", responseJsonSchema: RESPONSE_SCHEMA },
        }),
      },
    );

    if (!response.ok) {
      console.error("Gemini API error:", response.status, await response.text());
      return NextResponse.json({ ok: false, error: "Content generation failed." }, { status: 502 });
    }

    const data = await response.json();
    const rawText: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return NextResponse.json({ ok: false, error: "No content returned." }, { status: 502 });
    }

    const parsed = JSON.parse(rawText) as { blocks: RawBlock[] };
    const blocks = parsed.blocks
      .map((raw, i) => toTypedBlock(raw, i, knownIds))
      .filter((b): b is LearnContentBlock => b !== null);

    if (!blocks.some(isChallengeBlock)) {
      console.warn("learn-content: no challenge block survived validation, falling back", { lessonId, blockCount: blocks.length });
      return NextResponse.json({ ok: false, error: "No usable challenge generated." }, { status: 502 });
    }

    // Two challenges is the target; only accept one when the packet
    // itself was thin (see SYSTEM_PROMPT) — otherwise fall back to the
    // deterministic sequence, which enforces the same rule, rather than
    // silently shipping a shorter lesson than the data actually supports.
    const challengeCount = blocks.filter(isChallengeBlock).length;
    const thinData = !facts.hasScanHistory || facts.scanFoods.length < 2;
    if (!thinData && challengeCount < 2) {
      console.warn("learn-content: fewer challenge blocks than the data supports, falling back", { lessonId, challengeCount });
      return NextResponse.json({ ok: false, error: "Not enough usable challenges generated." }, { status: 502 });
    }

    const sequence: LearnContentSequence = {
      lessonId,
      nutrient: facts.nutrient,
      blocks,
      generatedAt: new Date().toISOString(),
      isFallback: false,
    };
    return NextResponse.json({ ok: true, sequence });
  } catch (err) {
    console.error("learn-content route error:", err);
    return NextResponse.json({ ok: false, error: "Something went wrong generating content." }, { status: 500 });
  }
}