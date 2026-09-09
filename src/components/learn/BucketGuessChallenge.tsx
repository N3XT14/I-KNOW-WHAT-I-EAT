"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { Profile } from "@/types/profile";
import { createChallengeAttempt, type BucketGuessAttempt } from "@/types/challengeAttempt";
import { saveChallengeAttempt, findPriorAttempt } from "@/lib/challengeAttempts";
import { refreshTutorTip } from "@/lib/tutorTip";
import { nutrientLabel } from "@/lib/nutrientLabels";
import type { NutrientKey } from "@/types/nutrientLimits";
import type { FoodEvent } from "@/types/foodEvent";
import type { EligibleFood } from "@/lib/challengePool";

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

// The original applied-challenge format: guess which %-of-daily-limit
// bucket a single real logged food fell into. `food` is already resolved
// by Challenge.tsx via challengePool's eligibleFoodsForNutrient — this
// component just runs the guess/reveal UI against it.
export default function BucketGuessChallenge({
  nutrient,
  lessonId,
  profile,
  events,
  food,
}: {
  nutrient: NutrientKey;
  lessonId: string;
  profile: Profile;
  events: FoodEvent[];
  food: EligibleFood;
}) {
  const { event, evaluation, productName } = food;
  const consumption = event.consumptions.find((c) => c.profileId === profile.id)!;
  const [guessIndex, setGuessIndex] = useState<number | null>(null);
  const prior = findPriorAttempt(profile.id, lessonId, "bucket-guess", [event.id]);

  const actualIndex = bucketIndexFor(evaluation.percentOfLimit);
  const answered = guessIndex !== null;
  const correct = answered && guessIndex === actualIndex;

  function submitGuess(i: number) {
    setGuessIndex(i);
    saveChallengeAttempt(
      createChallengeAttempt<BucketGuessAttempt>({
        kind: "bucket-guess",
        profileId: profile.id,
        lessonId,
        nutrient,
        foodEventId: event.id,
        guessedBucketIndex: i,
        actualBucketIndex: actualIndex,
        correct: i === actualIndex,
      }),
    );
    // Fire-and-forget — this is the actual event worth coaching on, not
    // the Learn page being viewed. See lib/tutorTip.ts.
    refreshTutorTip(profile, events);
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-on-surface)]">
          {productName}
        </h3>
        {prior && (
          <Badge tone="neutral">
            Tried before{prior.correct ? " · got it right" : ""}
          </Badge>
        )}
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