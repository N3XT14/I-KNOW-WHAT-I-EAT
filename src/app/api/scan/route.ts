import { NextRequest, NextResponse } from "next/server";
import type { LabelExtraction } from "@/types/labelExtraction";
import type { EstimatedExtraction } from "@/types/estimatedExtraction";
import type { FoodItem } from "@/types/foodItem";
import type { ScanApiResponse } from "@/types/scanResult";
import { getCachedScan, setCachedScan } from "@/lib/scanCache";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3.6-flash";

// The wire shape Gemini actually returns — flat, with exactly one of
// `sourced` / `estimated` populated depending on `kind`. We reshape this
// into a proper FoodItem below rather than exposing it past this file.
type RawScanResult = {
  kind: "sourced" | "estimated";
  productName: string | null;
  multipleItemsNote: string | null;
  headline: { verdict: string; drivingFact: string };
  sourced: {
    servingSize: string | null;
    nutrients: LabelExtraction["nutrients"];
    claims: LabelExtraction["claims"];
  } | null;
  estimated: {
    itemKind: EstimatedExtraction["itemKind"];
    watchItems: EstimatedExtraction["watchItems"];
  } | null;
};

const SYSTEM_PROMPT = `You look at a photo of food for a food-literacy app
aimed at parents and kids in India. The optional user-provided context, if
given, is extra help for your reasoning — never a request to produce
numbers you can't actually see.

STEP 1 — decide "kind" first, from the photo alone:
- "sourced": a real printed nutrition/ingredient label with actual numbers
  (%RDA, grams, etc) is clearly visible and readable in the photo. This
  includes packaged raw ingredients (a bag of dal, a box of cereal) as
  long as the label itself is visible — packaging alone without a
  readable label panel does not count.
- "estimated": no such label is visible — a home-cooked dish, a loose
  unpackaged ingredient, a packaged item where the label isn't in frame or
  isn't legible, anything you'd have to guess numbers for.
Never guess "sourced" from context or the food's identity — only from
actually seeing readable printed numbers in the photo. A home-cooked dish
that happens to look like a packaged product (e.g. bread) is still
"estimated" unless the actual label is visible and readable.

STEP 2, if "sourced" — extract the label:
- Only report what's actually printed or clearly shown. If a field isn't
  visible, use null rather than guessing.
- claims[].isMisleading is true only when the claim contradicts or
  overstates what the nutrient panel actually shows (e.g. "No Added Sugar"
  on something with real sugar content, or "Immunity Booster" with no
  evidence in the panel). If a claim is accurate, mark it false and say so.
- headline.drivingFact must translate at least one number into something
  concrete and relatable (teaspoons of sugar, % of a child's daily limit,
  etc) — never just repeat the printed number back.

STEP 2, if "estimated" — give a qualitative read, NOT sourced numbers:
- NEVER invent a specific gram amount, a percentage, or a %RDA figure —
  you have no label and no scale, so any such number would be fabricated
  and misleading. Speak in relative terms only ("looks like a generous
  amount of oil", "probably moderate in salt for a dish like this").
- itemKind: "prepared_dish" for a cooked dish/meal component,
  "raw_ingredient" for a single unprepared ingredient, "other" if neither
  fits clearly.
- watchItems: 1-4 items, each a nutrient AREA in plain language (e.g. "Oil
  / fat", "Sugar", "Salt", "Refined carbs") with a level (low/moderate/
  high) and a short plain-language note explaining the visual/contextual
  reasoning — not a measurement.
- headline.drivingFact must make clear this is an estimate from a photo,
  not a measurement (e.g. "Visibly a lot of ghee used — probably a
  higher-fat meal than an everyday one.").

Both cases:
- productName: your best guess at what the food/product is, or null if
  you genuinely can't tell.
- multipleItemsNote: null unless the photo clearly shows more than one
  distinct food item (e.g. a full thali, several packets). If so, briefly
  say what you see and that scanning each item separately gives a more
  accurate read — don't try to extract/estimate all of them at once here.
- headline.verdict: a short tag, 2-5 words (e.g. "High in sugar", "Looks
  oil-heavy", "Reasonably balanced") — never a full sentence, never a
  restatement of drivingFact. Rendered as a small pill in the UI.
- Keep every note and the headline warm, plain, and non-alarming — this is
  for a parent glancing at their phone, not a lab report.`;

// Appended when the requesting profile's language is Hindi. Scoped
// narrowly: only the app's own generated prose (headline.verdict,
// headline.drivingFact, claims[].note, estimated.watchItems[].note)
// changes language. productName, servingSize, nutrients[].name/amount,
// and claims[].text are all real printed values — carry those through
// exactly as read off the label/package regardless of language.
//
// This is NOT sent to the vision call — see localizeScanText below for
// why. It's the instruction used for the second, text-only translation
// pass.
const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  en: "",
  hi: `Translate each value in the JSON object below into Hindi, using
the Devanagari script. Use plain, everyday Hindi — the way you'd explain
a label to a parent at home, not textbook or formal Hindi. Prefer a
common Hindi word over a technical loanword wherever one exists (e.g.
"चीनी" not an English word for sugar); when no natural Hindi word exists
for a nutrition term, write the English term phonetically in Devanagari
(e.g. "सैचुरेटेड फैट") rather than switching to Latin script. Preserve
the exact meaning and every number exactly as given — this is a
translation of already-decided facts, not a chance to re-describe or
re-emphasize anything differently. Return a JSON object with the exact
same keys, each value replaced with its Hindi translation. If a value
quotes a product name or claim text verbatim (in quotation marks),
transliterate that quoted part phonetically into Devanagari too rather
than leaving it in Latin script, while keeping its wording and meaning
unchanged.`,
};

// Localizes the prose fields of an already-extracted result via a
// second, text-only Gemini call, instead of asking the vision call to
// produce Hindi directly. This matters for more than just convenience:
// headline.verdict/drivingFact and the claim/watch-item notes are
// generative writing, not OCR — asking two independent vision calls (one
// per language) to "read this photo and describe it" can genuinely
// diverge in which number or nutrient each one chooses to foreground,
// even at temperature 0.3. That means an English scan and a Hindi scan
// of the same photo could end up saying meaningfully different things,
// not just the same thing in a different language — confusing at best,
// a real trust problem for a food-literacy app at worst. Extracting the
// facts once in English and translating that exact text removes that
// risk: the second call has no image and nothing to freely reinterpret,
// only strings to translate.
//
// Never throws — on any failure (bad JSON, network error, malformed
// shape) this returns `raw` unchanged, so a translation hiccup degrades
// to "still-correct English text" rather than a broken response.
async function localizeScanText(raw: RawScanResult, language: string): Promise<RawScanResult> {
  if (language === "en" || !LANGUAGE_INSTRUCTIONS[language]) return raw;

  const toTranslate: Record<string, string> = {
    verdict: raw.headline.verdict,
    drivingFact: raw.headline.drivingFact,
  };
  if (raw.kind === "sourced" && raw.sourced) {
    raw.sourced.claims.forEach((c, i) => {
      toTranslate[`claimNote${i}`] = c.note;
    });
  } else if (raw.kind === "estimated" && raw.estimated) {
    raw.estimated.watchItems.forEach((w, i) => {
      toTranslate[`watchNote${i}`] = w.note;
    });
  }

  try {
    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: `${LANGUAGE_INSTRUCTIONS[language]}\n\n${JSON.stringify(toTranslate)}` },
              ],
            },
          ],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
      },
      2, // this is a small, cheap, non-image call — one retry is enough
    );
    if (!response.ok) return raw;

    const data = await response.json();
    const rawText: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return raw;

    const translated = JSON.parse(rawText) as Record<string, string>;

    const localized: RawScanResult = {
      ...raw,
      headline: {
        verdict: translated.verdict ?? raw.headline.verdict,
        drivingFact: translated.drivingFact ?? raw.headline.drivingFact,
      },
    };
    if (localized.kind === "sourced" && localized.sourced) {
      localized.sourced = {
        ...localized.sourced,
        claims: localized.sourced.claims.map((c, i) => ({
          ...c,
          note: translated[`claimNote${i}`] ?? c.note,
        })),
      };
    } else if (localized.kind === "estimated" && localized.estimated) {
      localized.estimated = {
        ...localized.estimated,
        watchItems: localized.estimated.watchItems.map((w, i) => ({
          ...w,
          note: translated[`watchNote${i}`] ?? w.note,
        })),
      };
    }
    return localized;
  } catch (err) {
    console.error("Scan text localization skipped:", err);
    return raw;
  }
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    kind: { type: "STRING", enum: ["sourced", "estimated"] },
    productName: { type: "STRING", nullable: true },
    multipleItemsNote: { type: "STRING", nullable: true },
    headline: {
      type: "OBJECT",
      properties: {
        verdict: {
          type: "STRING",
          description:
            "Short tag, 2-5 words, e.g. 'High in sugar' or 'Looks oil-heavy'. Never a full sentence.",
        },
        drivingFact: { type: "STRING" },
      },
      required: ["verdict", "drivingFact"],
      propertyOrdering: ["verdict", "drivingFact"],
    },
    sourced: {
      type: "OBJECT",
      nullable: true,
      properties: {
        servingSize: { type: "STRING", nullable: true },
        nutrients: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING" },
              amount: { type: "STRING" },
              percentDailyValue: { type: "NUMBER", nullable: true },
            },
            required: ["name", "amount", "percentDailyValue"],
            propertyOrdering: ["name", "amount", "percentDailyValue"],
          },
        },
        claims: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              text: { type: "STRING" },
              isMisleading: { type: "BOOLEAN" },
              note: { type: "STRING" },
            },
            required: ["text", "isMisleading", "note"],
            propertyOrdering: ["text", "isMisleading", "note"],
          },
        },
      },
      required: ["servingSize", "nutrients", "claims"],
      propertyOrdering: ["servingSize", "nutrients", "claims"],
    },
    estimated: {
      type: "OBJECT",
      nullable: true,
      properties: {
        itemKind: { type: "STRING", enum: ["prepared_dish", "raw_ingredient", "other"] },
        watchItems: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              nutrient: { type: "STRING" },
              level: { type: "STRING", enum: ["low", "moderate", "high"] },
              note: { type: "STRING" },
            },
            required: ["nutrient", "level", "note"],
            propertyOrdering: ["nutrient", "level", "note"],
          },
        },
      },
      required: ["itemKind", "watchItems"],
      propertyOrdering: ["itemKind", "watchItems"],
    },
  },
  required: ["kind", "productName", "multipleItemsNote", "headline", "sourced", "estimated"],
  propertyOrdering: [
    "kind",
    "productName",
    "multipleItemsNote",
    "headline",
    "sourced",
    "estimated",
  ],
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
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt)); // 500ms, 1000ms
    }
  }
  return lastResponse!;
}

function toFoodItem(raw: RawScanResult, userDescription: string | null): FoodItem {
  if (raw.kind === "sourced" && raw.sourced) {
    const extraction: LabelExtraction = {
      productName: raw.productName,
      servingSize: raw.sourced.servingSize,
      nutrients: raw.sourced.nutrients,
      claims: raw.sourced.claims,
      headline: raw.headline,
    };
    return { kind: "sourced", extraction };
  }
  // Falls through to "estimated" even if the model said "sourced" but
  // didn't actually populate `sourced` (shouldn't happen given the
  // schema's `required`, but never silently produce an empty extraction).
  const extraction: EstimatedExtraction = {
    itemKind: raw.estimated?.itemKind ?? "other",
    productName: raw.productName,
    userDescription,
    watchItems: raw.estimated?.watchItems ?? [],
    headline: raw.headline,
  };
  return { kind: "estimated", extraction };
}

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json<ScanApiResponse>(
      { ok: false, error: "Server is missing GEMINI_API_KEY." },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => null);
  const imageBase64: string | undefined = body?.imageBase64;
  const mediaType: string | undefined = body?.mediaType;
  const userDescription: string | null =
    typeof body?.userDescription === "string" && body.userDescription.trim()
      ? body.userDescription.trim()
      : null;
  const language: string = body?.language ?? "en";

  if (!imageBase64 || !mediaType) {
    return NextResponse.json<ScanApiResponse>(
      { ok: false, error: "No image provided." },
      { status: 400 },
    );
  }

  const cached = await getCachedScan(imageBase64, mediaType, userDescription, language);
  if (cached) {
    return NextResponse.json<ScanApiResponse>(cached);
  }

  // Always extract in English, regardless of the requesting profile's
  // language — see localizeScanText's comment for why. Only the
  // English-facts-then-translate path varies by language, not the vision
  // read itself.
  const promptText = userDescription
    ? `Read this food photo per the system instructions. Extra context from the user: "${userDescription}"`
    : "Read this food photo per the system instructions. No extra context was given.";

  try {
    const response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            {
              parts: [
                { text: promptText },
                { inline_data: { mime_type: mediaType, data: imageBase64 } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      const message =
        response.status === 503
          ? "Gemini is under high demand right now — please try again in a moment."
          : "Reading that photo failed. Try again.";
      return NextResponse.json<ScanApiResponse>({ ok: false, error: message }, { status: 502 });
    }

    const data = await response.json();
    const rawText: string | undefined =
      data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      console.error("No text in Gemini response:", JSON.stringify(data));
      return NextResponse.json<ScanApiResponse>(
        { ok: false, error: "No read returned. Try a clearer photo." },
        { status: 502 },
      );
    }

    const raw = JSON.parse(rawText) as RawScanResult;
    const localizedRaw = await localizeScanText(raw, language);
    const item = toFoodItem(localizedRaw, userDescription);
    const result: Extract<ScanApiResponse, { ok: true }> = {
      ok: true,
      item,
      multipleItemsNote: localizedRaw.multipleItemsNote,
    };
    await setCachedScan(imageBase64, mediaType, userDescription, language, result);

    return NextResponse.json<ScanApiResponse>(result);
  } catch (err) {
    console.error("Scan route error:", err);
    return NextResponse.json<ScanApiResponse>(
      { ok: false, error: "Something went wrong reading that photo." },
      { status: 500 },
    );
  }
}