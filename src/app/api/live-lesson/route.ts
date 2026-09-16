import { NextRequest, NextResponse } from "next/server";
import type { LearnFactsPacket } from "@/lib/learnContentPool";
import type { LiveLessonPhase, LiveLessonResponse, LiveLessonTurn, LiveLessonVerdict } from "@/types/liveLesson";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3.6-flash";

// Scoped deliberately narrow, same line the hackathon-scope conversation
// drew: this teaches reading a label/understanding a nutrient using the
// learner's own real scans as material. It does NOT give personalized
// health, diet, or medical advice about the learner's own body — that's
// a different, much less grounded problem, and this app's credibility so
// far rests on never saying anything that isn't traceable to a sourced
// number or the label itself.
const SYSTEM_PROMPT = `You are a warm, patient tutor mascot running a
short LIVE CLASS — not a quiz — for a parent or kid in India learning to
read food labels. You'll be given a JSON "facts" packet (real logged
foods, a real nutrient limit, real label claims, real glossary terms)
and the conversation so far. Use ONLY the numbers, names, and claims
already present in that packet — never invent a gram amount, a
percentage, a food name, or a claim that isn't there. Never give
personalized health, diet, or medical advice about the learner's own
body or what they specifically should eat — you are teaching them to
read and reason about a label, not advising them on their health.

You will be told which PHASE to produce next:

- "teach": Open (or continue) the class by picking ONE real food from
  facts.scanFoods that is NOT already in usedFoodEventIds, and using it
  to explain one clear, concrete idea about facts.nutrientLabel. If
  facts.hasScanHistory is false, teach the same kind of idea generically
  using facts.glossary or facts.claims instead, and leave the example
  food unset. This is a one-way teaching turn — end with something like
  "let's see if that landed" rather than a question. The learner will
  tap Continue, not type anything, after this turn.
- "check": Ask ONE open-ended question — never multiple choice — about a
  DIFFERENT real food from facts.scanFoods than anything already in
  usedFoodEventIds, one that requires applying what was just taught. The
  learner WILL type a free-text answer to this.
- "evaluate": The last entry in the conversation is the learner's typed
  answer to your most recent "check" question. Judge it strictly against
  the real facts (never invent a fact to justify your judgment) and
  classify it as "got-it", "partial", or "missed". Respond warmly either
  way. If "got-it", congratulate them specifically — reference what they
  actually got right, not a generic "well done." If "partial" or
  "missed", gently re-explain the same idea in different words, using
  the same example food they just answered about — no scolding, no
  "wrong," just re-teach it more simply.
- "recap": Close the session. In 2-3 warm sentences, summarize the one
  or two ideas covered and what the learner specifically got right this
  session.

Keep every message to 2-4 short sentences — plain, warm, spoken-aloud
register, like a patient tutor sitting next to someone, never a lecture
and never a quiz-show host.`;

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  en: "",
  hi: `Write "message" in Hindi, using the Devanagari script. Use plain,
everyday Hindi — the way you'd explain something to a parent at home,
not textbook or formal Hindi. Prefer a common Hindi word over a
technical loanword wherever one exists; when no natural Hindi word
exists for a nutrition term, write it phonetically in Devanagari rather
than switching to Latin script. If you quote a claim or product name
from the facts packet inside your sentence, transliterate that quoted
part phonetically into Devanagari too, preserving its exact wording and
meaning, rather than leaving it in Latin script.`,
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    message: { type: "string" },
    exampleFoodEventId: { type: ["string", "null"] },
    verdict: { type: ["string", "null"], enum: ["got-it", "partial", "missed", null] },
  },
  required: ["message"],
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

function phaseInstruction(phase: LiveLessonPhase): string {
  return `Produce the "${phase}" phase now, per the rules for that phase in the system instructions.`;
}

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json<LiveLessonResponse>({ ok: false, error: "Server is missing GEMINI_API_KEY." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const facts: LearnFactsPacket | undefined = body?.facts;
  const phase: LiveLessonPhase | undefined = body?.phase;
  const turns: LiveLessonTurn[] = Array.isArray(body?.turns) ? body.turns : [];
  const usedFoodEventIds: string[] = Array.isArray(body?.usedFoodEventIds) ? body.usedFoodEventIds : [];
  const language: string = body?.language ?? "en";

  if (!facts || !phase) {
    return NextResponse.json<LiveLessonResponse>({ ok: false, error: "Missing facts or phase." }, { status: 400 });
  }

  const knownIds = new Set(facts.scanFoods.map((f) => f.foodEventId));
  const languageInstruction = LANGUAGE_INSTRUCTIONS[language] ?? "";

  const conversationText = turns.length
    ? `Conversation so far:\n${turns.map((t) => `${t.role}: ${t.text}`).join("\n")}\n\n`
    : "";

  const promptText = `Facts packet:\n${JSON.stringify(facts)}\n\nAlready-used foodEventIds this session (do not reuse as the example/question subject): ${JSON.stringify(usedFoodEventIds)}\n\n${conversationText}${phaseInstruction(phase)}${languageInstruction ? `\n\n${languageInstruction}` : ""}`;

  try {
    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { temperature: 0.6, responseMimeType: "application/json", responseJsonSchema: RESPONSE_SCHEMA },
        }),
      },
    );

    if (!response.ok) {
      console.error("live-lesson Gemini error:", response.status, await response.text());
      return NextResponse.json<LiveLessonResponse>({ ok: false, error: "Couldn't reach the tutor." }, { status: 502 });
    }

    const data = await response.json();
    const rawText: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return NextResponse.json<LiveLessonResponse>({ ok: false, error: "No response from the tutor." }, { status: 502 });
    }

    const parsed = JSON.parse(rawText) as { message?: string; exampleFoodEventId?: string | null; verdict?: string | null };
    if (!parsed.message) {
      return NextResponse.json<LiveLessonResponse>({ ok: false, error: "Empty response from the tutor." }, { status: 502 });
    }

    // Never trust a foodEventId that isn't actually in this packet — drop
    // it rather than reject the whole turn, since the message text is
    // still perfectly usable without a valid example anchor.
    const exampleFoodEventId =
      parsed.exampleFoodEventId && knownIds.has(parsed.exampleFoodEventId) ? parsed.exampleFoodEventId : null;

    const validVerdicts: LiveLessonVerdict[] = ["got-it", "partial", "missed"];
    const verdict =
      phase === "evaluate" && validVerdicts.includes(parsed.verdict as LiveLessonVerdict)
        ? (parsed.verdict as LiveLessonVerdict)
        : phase === "evaluate"
          ? "partial" // malformed/missing verdict on an evaluate turn — default to the gentler path rather than silently dropping the turn
          : null;

    return NextResponse.json<LiveLessonResponse>({ ok: true, message: parsed.message, exampleFoodEventId, verdict });
  } catch (err) {
    console.error("live-lesson route error:", err);
    return NextResponse.json<LiveLessonResponse>({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}