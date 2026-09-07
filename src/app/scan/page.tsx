"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Upload, Loader2, RotateCcw, ChevronDown } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import LogConsumptionPanel from "@/components/profile/LogConsumptionPanel";
import ProfileSwitcher from "@/components/profile/ProfileSwitcher";
import type { LabelExtraction, ScanApiResponse } from "@/types/labelExtraction";
import { currentAgeBand, type Profile } from "@/types/profile";
import { getProfiles, getActiveProfileId } from "@/lib/profiles";
import { evaluateNutrientForConsumption, type NutrientEvaluation } from "@/types/learnMode";
import { FSSAI_LABEL_BASIS, type NutrientKey } from "@/types/nutrientLimits";
import { nutrientLabel } from "@/lib/nutrientLabels";
import { SEED_LABELS } from "@/lib/seedLabels";
import type { FoodEvent } from "@/types/foodEvent";

// FSSAI's %RDA on a label is always computed against one fixed adult
// reference (see FSSAI_LABEL_BASIS), regardless of who's actually eating
// it — so "15% RDA" printed on a snack means something different for a
// 4-year-old than for an adult. This is the reference each tracked
// nutrient's printed %RDA is silently assuming.
const FSSAI_REFERENCE_FOR: Record<NutrientKey, number> = {
  sugar: FSSAI_LABEL_BASIS.addedSugarG,
  sodium: FSSAI_LABEL_BASIS.sodiumMg,
  saturatedFat: FSSAI_LABEL_BASIS.saturatedFatG,
};
const TRACKED_NUTRIENTS: NutrientKey[] = ["sugar", "sodium", "saturatedFat"];

type Status = "idle" | "loading" | "error";
type Comparison = { nutrient: NutrientKey; evaluation: NutrientEvaluation; fssaiReference: number };

// A label is good, borderline, or actually high in something — that
// three-way read is the entire point of the app, so the headline badge
// (and the comparison card) use it instead of one generic "primary" tone.
// Falls back to the model's own misleading-claims flag when there's no
// active profile yet to compute a real percentage against.
function verdictTone(comparisons: Comparison[], hasMisleadingClaim: boolean): "good" | "caution" | "high" {
  if (comparisons.length > 0) {
    const worst = Math.max(...comparisons.map((c) => c.evaluation.percentOfLimit));
    if (worst >= 100) return "high";
    if (worst >= 60) return "caution";
    return "good";
  }
  return hasMisleadingClaim ? "high" : "good";
}

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // "data:image/jpeg;base64,AAAA..." -> split off the prefix
      const [prefix, base64] = result.split(",");
      const mediaType = prefix.match(/data:(.*);base64/)?.[1] ?? "image/jpeg";
      resolve({ base64, mediaType });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ScanPage() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<LabelExtraction | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
  // The FoodEvent this scan has produced, once logged at least once. Kept
  // null until then — analysis intentionally waits for a real logged
  // portion rather than assuming one, so nothing here is a computed guess.
  const [loggedEvent, setLoggedEvent] = useState<FoodEvent | null>(null);
  const [showFullBreakdown, setShowFullBreakdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // localStorage only exists client-side — load after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshProfiles();
  }, []);

  function refreshProfiles() {
    setProfiles(getProfiles());
    setActiveProfileIdState(getActiveProfileId());
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;

    setStatus("loading");
    setErrorMessage(null);
    setExtraction(null);
    setIsSample(false);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const { base64, mediaType } = await fileToBase64(file);
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });
      const data: ScanApiResponse = await res.json();

      if (!data.ok) {
        setStatus("error");
        setErrorMessage(data.error);
        return;
      }

      setExtraction(data.extraction);
      setLoggedEvent(null);
      setShowFullBreakdown(false);
      setStatus("idle");
    } catch {
      setStatus("error");
      setErrorMessage("Couldn't reach the server. Check your connection and try again.");
    }
  }

  function reset() {
    setPreviewUrl(null);
    setExtraction(null);
    setErrorMessage(null);
    setIsSample(false);
    setLoggedEvent(null);
    setShowFullBreakdown(false);
    setStatus("idle");
  }

  function loadSample(id: string) {
    const sample = SEED_LABELS.find((s) => s.id === id);
    if (!sample) return;
    setPreviewUrl(null);
    setErrorMessage(null);
    setExtraction(sample.extraction);
    setIsSample(true);
    setLoggedEvent(null);
    setShowFullBreakdown(false);
    setStatus("idle");
  }

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;
  const activeConsumption =
    loggedEvent?.consumptions.find((c) => c.profileId === activeProfileId) ?? null;

  const comparisons: Comparison[] = (() => {
    if (!extraction || !activeProfile || !activeConsumption) return [];
    const ageBand = currentAgeBand(activeProfile.dob);
    return TRACKED_NUTRIENTS.map((nutrient) => {
      const evaluation = evaluateNutrientForConsumption(
        extraction,
        nutrient,
        ageBand,
        activeConsumption.portionMultiplier,
      );
      if (!evaluation) return null;
      return { nutrient, evaluation, fssaiReference: FSSAI_REFERENCE_FOR[nutrient] };
    }).filter((c): c is Comparison => c !== null);
  })();

  const hasMisleadingClaim = extraction?.claims.some((c) => c.isMisleading) ?? false;
  const tone = verdictTone(comparisons, hasMisleadingClaim);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 pb-6">
      <header className="flex items-start justify-between gap-3 pt-2">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-on-surface)]">
            Scan a label
          </h1>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Point your camera at the nutrition panel.
          </p>
        </div>
        {profiles.length > 0 && (
          <ProfileSwitcher
            profiles={profiles}
            activeProfileId={activeProfileId}
            onChange={refreshProfiles}
          />
        )}
      </header>

      {!previewUrl && !extraction && (
        <Card className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="rounded-full bg-[var(--color-primary-container)] p-4">
            <Camera className="h-8 w-8 text-[var(--color-primary-dark)]" />
          </div>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            Take a photo, or upload one from your gallery.
          </p>
          <div className="flex w-full flex-col gap-2">
            {/* capture="environment" opens the rear camera directly on mobile;
                falls back to a normal file picker on desktop. */}
            <label className="w-full">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <span className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-[var(--color-on-primary)] hover:opacity-90">
                <Camera className="h-4 w-4" />
                Take a photo
              </span>
            </label>
            <label className="w-full">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <span className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-outline)] px-4 py-3 text-sm font-semibold text-[var(--color-on-surface)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary-dark)]">
                <Upload className="h-4 w-4" />
                Upload from gallery
              </span>
            </label>
          </div>

          <div className="w-full border-t border-[var(--color-outline)] pt-4">
            <p className="mb-2 text-xs text-[var(--color-on-surface-variant)]">
              Don&apos;t have a label handy? Try a sample:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SEED_LABELS.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => loadSample(sample.id)}
                  className="rounded-[var(--radius-pill)] border border-[var(--color-outline)] px-3 py-1.5 text-xs text-[var(--color-on-surface)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
                >
                  {sample.title}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {previewUrl && (
        <Card className="overflow-hidden p-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Label preview"
            className="max-h-72 w-full object-contain bg-[var(--color-surface-variant)]"
          />
        </Card>
      )}

      {status === "loading" && (
        <Card className="flex items-center justify-center gap-3 p-6">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-primary)]" />
          <span className="text-sm text-[var(--color-on-surface-variant)]">
            Reading the label...
          </span>
        </Card>
      )}

      {status === "error" && errorMessage && (
        <Card className="border-[var(--color-error)]/40 bg-[var(--color-error-container)] p-4">
          <p className="text-sm text-[var(--color-error)]">{errorMessage}</p>
          <p className="mt-3 mb-2 text-xs text-[var(--color-error)]">
            Or continue with a sample label instead:
          </p>
          <div className="flex flex-wrap gap-2">
            {SEED_LABELS.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => loadSample(sample.id)}
                className="rounded-[var(--radius-pill)] border border-[var(--color-error)]/40 bg-[var(--color-surface)] px-3 py-1.5 text-xs text-[var(--color-error)] hover:opacity-80"
              >
                {sample.title}
              </button>
            ))}
          </div>
        </Card>
      )}

      {extraction && (
        <div className="flex flex-col gap-3">
          {isSample && (
            <Badge tone="neutral" className="w-fit">
              Sample label · not a live scan
            </Badge>
          )}

          {/* Instant Check — the headline verdict + the one number behind
              it, always visible, never hidden behind a tap. The verdict
              badge reflects the actual good/caution/high read once a
              profile's logged their portion (see the analysis card below);
              until then it falls back to the misleading-claims flag. */}
          <Card variant="elevated" className="p-5">
            <Badge tone={tone}>{extraction.headline.verdict}</Badge>
            <p
              // The display font is still reserved for this — the one
              // thing on the screen meant to be read first — but sized
              // for what drivingFact actually is: a short sentence, not a
              // bare number. 2xl/bold on a full sentence read as broken
              // layout rather than emphasis.
              className="mt-2 text-lg font-semibold leading-snug text-[var(--color-on-surface)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {extraction.headline.drivingFact}
            </p>
            {extraction.productName && (
              <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
                {extraction.productName}
                {extraction.servingSize ? ` · per ${extraction.servingSize}` : ""}
              </p>
            )}
          </Card>

          {/* Logging moves right under the headline now — it's the one
              thing every visit needs to end with. This is an inline
              collapsible panel, not a modal — after the dialog-based
              version kept overflowing the phone frame in ways that
              couldn't be pinned down without live rendering to inspect,
              inline is structurally immune to that class of bug: it's
              normal page flow, same as everything else on this screen,
              so there's no overlay/viewport boundary for it to escape. */}
          <LogConsumptionPanel
            extraction={extraction}
            profiles={profiles}
            event={loggedEvent}
            onLogged={setLoggedEvent}
          />

          {activeProfile && comparisons.length === 0 && (
            <Card className="p-4">
              <p className="text-sm text-[var(--color-on-surface-variant)]">
                Log this scan for {activeProfile.name} to see what it
                actually means for their daily limits — we won&apos;t guess
                a portion for you.
              </p>
            </Card>
          )}

          {comparisons.length > 0 && activeProfile && activeConsumption && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-[var(--color-on-surface)]">
                What that means for {activeProfile.name}
                {activeConsumption.portionMultiplier !== 1
                  ? ` (${activeConsumption.portionMultiplier} serving${activeConsumption.portionMultiplier === 1 ? "" : "s"})`
                  : ""}
              </h2>
              <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
                A label&apos;s %RDA is always calculated against one fixed
                adult reference (FSSAI, 2000 kcal/day) — not against{" "}
                {activeProfile.name}&apos;s own age, and it&apos;s
                per-serving. This adjusts for both.
              </p>
              <ul className="mt-3 flex flex-col gap-3">
                {comparisons.map(({ nutrient, evaluation, fssaiReference }) => (
                  <li key={nutrient} className="text-sm">
                    <div className="flex items-center justify-between text-[var(--color-on-surface)]">
                      <span className="capitalize">{nutrientLabel(nutrient)}</span>
                      <span
                        className="font-semibold"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {evaluation.percentOfLimit}% of {activeProfile.name}&apos;s limit
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--color-on-surface-variant)]">
                      Label&apos;s reference: {fssaiReference}
                      {evaluation.unit}/day for an adult · {activeProfile.name}&apos;s actual
                      limit: {evaluation.limit}
                      {evaluation.unit}/day
                    </p>
                    <Badge
                      className="mt-1"
                      tone={evaluation.confidence === "verified" ? "info" : "neutral"}
                    >
                      {evaluation.confidence === "estimated" ? "Estimated · " : ""}
                      {evaluation.source}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Everything below here is detail, not the verdict — collapsed
              by default so the screen isn't a wall of visually-repetitive
              cards every single time. */}
          <button
            type="button"
            onClick={() => setShowFullBreakdown((v) => !v)}
            className="flex w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-outline)] bg-[var(--color-surface)] px-4 py-3 text-sm font-semibold text-[var(--color-on-surface)]"
          >
            Full label breakdown
            <ChevronDown
              className={`h-4 w-4 text-[var(--color-on-surface-variant)] transition-transform ${showFullBreakdown ? "rotate-180" : ""}`}
            />
          </button>

          {showFullBreakdown && (
            <div className="flex flex-col gap-3">
              {extraction.claims.length > 0 && (
                <Card className="p-4">
                  <h2 className="mb-2 text-sm font-semibold text-[var(--color-on-surface)]">
                    What the label claims
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {extraction.claims.map((claim, i) => (
                      <li key={i} className="text-sm">
                        <Badge tone={claim.isMisleading ? "high" : "good"}>
                          {claim.text}
                        </Badge>
                        <p className="mt-1 text-[var(--color-on-surface-variant)]">
                          {claim.note}
                        </p>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card className="p-4">
                <h2 className="mb-2 text-sm font-semibold text-[var(--color-on-surface)]">
                  What&apos;s actually in it
                </h2>
                <ul className="flex flex-col gap-1.5">
                  {extraction.nutrients.map((n, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between text-sm text-[var(--color-on-surface)]"
                    >
                      <span>{n.name}</span>
                      <span className="text-[var(--color-on-surface-variant)]">
                        {n.amount}
                        {n.percentDailyValue !== null ? ` · ${n.percentDailyValue}% RDA` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}

          <Button
            variant="outline"
            onClick={reset}
            className="flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Scan another label
          </Button>
        </div>
      )}
    </main>
  );
}