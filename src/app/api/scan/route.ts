import { NextRequest, NextResponse } from "next/server";
import type { LabelExtraction, ScanApiResponse } from "@/types/labelExtraction";
import { getCachedExtraction, setCachedExtraction } from "@/lib/scanCache";


const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const MODEL = "gemini-3.6-flash";

const SYSTEM_PROMPT = `You read real Indian packaged-food labels for a
literacy app aimed at parents and kids. You are not a scanner that just
outputs numbers — every field you return should make the label
understandable to someone who finds jargon and %RDA figures confusing.

Rules:
- Only report what's actually printed or clearly shown on the label. If a
  field isn't visible, use null rather than guessing.
- "isMisleading" on a claim is true only when the claim contradicts or
  overstates what the nutrient panel actually shows (e.g. "No Added Sugar"
  on something with 15g sugar per serving from other sources, or "Immunity
  Booster" with no evidence in the panel). If a claim is accurate, mark it
  false and say so plainly.
- headline.drivingFact must translate at least one number into something
  concrete and relatable (teaspoons of sugar, % of a child's daily limit,
  etc) — never just repeat the printed number back.
- Keep every "note" and the headline in plain, warm, non-alarming language.
  This is for a worried parent, not a lab report.`;


const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    productName: { type: "STRING", nullable: true },
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
    headline: {
      type: "OBJECT",
      properties: {
        verdict: { type: "STRING" },
        drivingFact: { type: "STRING" },
      },
      required: ["verdict", "drivingFact"],
      propertyOrdering: ["verdict", "drivingFact"],
    },
  },
  required: ["productName", "servingSize", "nutrients", "claims", "headline"],
  propertyOrdering: ["productName", "servingSize", "nutrients", "claims", "headline"],
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

  if (!imageBase64 || !mediaType) {
    return NextResponse.json<ScanApiResponse>(
      { ok: false, error: "No image provided." },
      { status: 400 },
    );
  }

  const cached = await getCachedExtraction(imageBase64, mediaType);
  if (cached) {
    return NextResponse.json<ScanApiResponse>({ ok: true, extraction: cached });
  }

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
                { text: "Extract this food label per the system instructions." },
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
          : "Label extraction failed. Try again.";
      return NextResponse.json<ScanApiResponse>(
        { ok: false, error: message },
        { status: 502 },
      );
    }

    const data = await response.json();
    const rawText: string | undefined =
      data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      console.error("No text in Gemini response:", JSON.stringify(data));
      return NextResponse.json<ScanApiResponse>(
        { ok: false, error: "No extraction returned. Try a clearer photo." },
        { status: 502 },
      );
    }

    const extraction: LabelExtraction = JSON.parse(rawText);
    await setCachedExtraction(imageBase64, mediaType, extraction);

    return NextResponse.json<ScanApiResponse>({ ok: true, extraction });
  } catch (err) {
    console.error("Scan route error:", err);
    return NextResponse.json<ScanApiResponse>(
      { ok: false, error: "Something went wrong reading that label." },
      { status: 500 },
    );
  }
}