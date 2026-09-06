"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Upload, Loader2, RotateCcw } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import LogConsumption from "@/components/profile/LogConsumption";
import type { LabelExtraction, ScanApiResponse } from "@/types/labelExtraction";
import { currentAgeBand, type Profile } from "@/types/profile";
import { getProfiles, getActiveProfileId } from "@/lib/profiles";
import { evaluateNutrientForConsumption } from "@/types/learnMode";
import { FSSAI_LABEL_BASIS, type NutrientKey } from "@/types/nutrientLimits";
import { nutrientLabel } from "@/lib/nutrientLabels";
import { SEED_LABELS } from "@/lib/seedLabels";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProfiles(getProfiles());
    setActiveProfileIdState(getActiveProfileId());
  }, []);

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
    setStatus("idle");
  }

  function loadSample(id: string) {
    const sample = SEED_LABELS.find((s) => s.id === id);
    if (!sample) return;
    setPreviewUrl(null);
    setErrorMessage(null);
    setExtraction(sample.extraction);
    setIsSample(true);
    setStatus("idle");
  }

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;

  const comparisons = (() => {
    if (!extraction || !activeProfile) return [];
    const ageBand = currentAgeBand(activeProfile.dob);
    return TRACKED_NUTRIENTS.map((nutrient) => {
      const evaluation = evaluateNutrientForConsumption(extraction, nutrient, ageBand, 1);
      if (!evaluation) return null;
      return { nutrient, evaluation, fssaiReference: FSSAI_REFERENCE_FOR[nutrient] };
    }).filter((c): c is NonNullable<typeof c> => c !== null);
  })();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col gap-4 p-4 pb-10">
      <header className="pt-2">
        <h1 className="text-xl font-semibold text-[var(--color-on-surface)]">
          Scan a label
        </h1>
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          Point your camera at the nutrition panel.
        </p>
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
          {/* Instant Check — the headline verdict + the one number behind it,
              always visible, never hidden behind a tap. */}
          <Card variant="elevated" className="p-5">
            <Badge tone={extraction.claims.some((c) => c.isMisleading) ? "attention" : "primary"}>
              {extraction.headline.verdict}
            </Badge>
            <p className="mt-2 text-base text-[var(--color-on-surface)]">
              {extraction.headline.drivingFact}
            </p>
            {extraction.productName && (
              <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
                {extraction.productName}
                {extraction.servingSize ? ` · per ${extraction.servingSize}` : ""}
              </p>
            )}
          </Card>

          {extraction.claims.length > 0 && (
            <Card className="p-4">
              <h2 className="mb-2 text-sm font-semibold text-[var(--color-on-surface)]">
                What the label claims
              </h2>
              <ul className="flex flex-col gap-2">
                {extraction.claims.map((claim, i) => (
                  <li key={i} className="text-sm">
                    <Badge tone={claim.isMisleading ? "error" : "primary"}>
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

          {comparisons.length > 0 && activeProfile && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-[var(--color-on-surface)]">
                What that %RDA actually means for {activeProfile.name}
              </h2>
              <p className="mt-1 text-xs text-[var(--color-on-surface-variant)]">
                A label&apos;s %RDA is always calculated against one fixed
                adult reference (FSSAI, 2000 kcal/day) — not against{" "}
                {activeProfile.name}&apos;s own age.
              </p>
              <ul className="mt-3 flex flex-col gap-3">
                {comparisons.map(({ nutrient, evaluation, fssaiReference }) => (
                  <li key={nutrient} className="text-sm">
                    <div className="flex items-center justify-between text-[var(--color-on-surface)]">
                      <span className="capitalize">{nutrientLabel(nutrient)}</span>
                      <span className="font-semibold">
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

          <LogConsumption
            extraction={extraction}
            profiles={profiles}
            activeProfileId={activeProfileId}
          />

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