"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { currentAgeBand, type Profile } from "@/types/profile";
import type { FoodEvent } from "@/types/foodEvent";
import { isSourced } from "@/types/foodItem";
import { evaluateNutrientForConsumption } from "@/types/learnMode";
import type { NutrientKey } from "@/types/nutrientLimits";
import { createChallengeAttempt } from "@/types/challengeAttempt";
import { saveChallengeAttempt } from "@/lib/challengeAttempts";
import { nutrientLabel } from "@/lib/nutrientLabels";

const BUCKETS = [
  { label: "Less than 25%", max: 25 },
  { label: "25–50%", max: 50 },
  { label: "50–100%", max: 100 },
  { label: "100% or more", max: Infinity },
];

function bucketIndexFor(percent: number): number {
  const index = BUCKETS.findIndex((b) => percent <= b.max);
  return index === -1 ? BUCKETS.length - 1 : index;
}

// Picks the most recently logged food (by this profile) whose label
// actually printed the nutrient in question, and runs the applied
// challenge against it — a real scan the family did, not a canned example.
export default function Challenge({
  nutrient,
  lessonId,
  profile,
  events,
}: {
  nutrient: NutrientKey;
  lessonId: string;
  profile: Profile;
  events: FoodEvent[];
}) {
  const attempt = (() => {
    const ageBand = currentAgeBand(profile.dob);
    // Challenges run against real sourced numbers only — an estimated
    // (home-cooked/unlabeled) read has no %RDA to quiz against, see
    // types/foodItem.ts.
    const sourcedEvents = events.filter((e) => isSourced(e.item));
    const sorted = [...sourcedEvents].sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));
    for (const event of sorted) {
      const consumption = event.consumptions.find((c) => c.profileId === profile.id);
      if (!consumption) continue;
      if (!isSourced(event.item)) continue;
      const evaluation = evaluateNutrientForConsumption(
        event.item.extraction,
        nutrient,
        ageBand,
        consumption.portionMultiplier,
        profile.sex,
      );
      if (evaluation) return { event, evaluation, consumption };
    }
    return null;
  })();

  const [guessIndex, setGuessIndex] = useState<number | null>(null);

  if (!attempt) {
    return (
      <Card className="flex flex-col gap-2 p-4">
        <p className="text-sm text-[var(--color-on-surface-variant)]">
          Scan and log a food that lists {nutrientLabel(nutrient)} for{" "}
          {profile.name} to try this challenge — nothing logged yet has it on
          the label.
        </p>
      </Card>
    );
  }

  const { event, evaluation, consumption } = attempt;
  const actualIndex = bucketIndexFor(evaluation.percentOfLimit);
  const answered = guessIndex !== null;
  const correct = answered && guessIndex === actualIndex;

  function submitGuess(i: number) {
    setGuessIndex(i);
    saveChallengeAttempt(
      createChallengeAttempt({
        profileId: profile.id,
        lessonId,
        nutrient,
        foodEventId: event.id,
        guessedBucketIndex: i,
        actualBucketIndex: actualIndex,
        correct: i === actualIndex,
      }),
    );
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-on-surface)]">
          {event.item.extraction.productName ?? "That food you logged"}
        </h3>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          How much of {profile.name}&apos;s daily {nutrientLabel(nutrient)}{" "}
          limit do you think that used?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {BUCKETS.map((bucket, i) => {
          const isSelected = guessIndex === i;
          const isActual = answered && i === actualIndex;
          return (
            <button
              key={bucket.label}
              type="button"
              disabled={answered}
              onClick={() => submitGuess(i)}
              className={`rounded-[var(--radius-md)] border px-3 py-2.5 text-sm transition-colors ${
                isActual
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-container)] text-[var(--color-primary-dark)]"
                  : isSelected
                    ? "border-[var(--color-error)] bg-[var(--color-error-container)] text-[var(--color-error)]"
                    : "border-[var(--color-outline)] text-[var(--color-on-surface)]"
              } ${answered ? "cursor-default" : ""}`}
            >
              {bucket.label}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="flex flex-col gap-2 border-t border-[var(--color-outline)] pt-3">
          <Badge tone={correct ? "primary" : "attention"}>
            {correct ? "Nice — that's right." : "Not quite."}
          </Badge>
          <p className="text-sm text-[var(--color-on-surface)]">
            It actually used <strong>{evaluation.percentOfLimit}%</strong> of
            the daily limit ({evaluation.amountConsumed}
            {evaluation.unit} of {evaluation.limit}
            {evaluation.unit}).
          </p>
          <p className="text-xs text-[var(--color-on-surface-variant)]">
            The label lists {evaluation.perServing}
            {evaluation.unit} per serving — {profile.name} had{" "}
            {consumption.portionMultiplier}x a serving, for{" "}
            {evaluation.amountConsumed}
            {evaluation.unit} total.
          </p>
          <Badge tone={evaluation.confidence === "verified" ? "info" : "neutral"}>
            {evaluation.confidence === "estimated" ? "Estimated · " : ""}
            {evaluation.source}
          </Badge>
          <Button
            variant="outline"
            className="w-fit"
            onClick={() => setGuessIndex(null)}
          >
            Try again
          </Button>
        </div>
      )}
    </Card>
  );
}